"""NEXUS API application factory."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from server.api.deps import Container
from server.api.v1 import governance, runs, system
from server.core.config import Settings, get_settings
from server.core.logging import RequestContextMiddleware, configure_logging
from server.core.telemetry import setup_tracing
from server.db.session import Database
from server.llm.gateway import LLMGateway, Provider, build_providers
from server.memory.store import MemoryStore, build_embedder
from server.services.runs import RunService
from server.tools.search import SearchTool

log = structlog.get_logger(__name__)


def build_container(settings: Settings, providers: list[Provider] | None = None) -> Container:
    db = Database(settings.database_url)
    gateway = LLMGateway(
        build_providers(settings) if providers is None else providers, allow_simulator=settings.allow_simulator_fallback
    )
    memory = MemoryStore(
        build_embedder(settings), min_similarity=settings.memory_min_similarity, top_k=settings.memory_top_k
    )
    runs_service = RunService(settings=settings, db=db, gateway=gateway, memory=memory, search=SearchTool(settings))
    return Container(settings=settings, db=db, gateway=gateway, memory=memory, runs=runs_service)


def create_app(settings: Settings | None = None, providers: list[Provider] | None = None) -> FastAPI:
    settings = settings or get_settings()
    settings.validate_for_runtime()
    configure_logging(settings.log_level, settings.log_json)
    container = build_container(settings, providers)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if settings.auto_create_schema:
            await container.db.create_all()
        recovered = await container.runs.recover_interrupted()
        log.info(
            "nexus.started",
            env=settings.environment.value,
            providers=container.gateway.live_provider_names,
            auth=settings.auth_mode.value,
            recovered_runs=recovered,
        )
        yield
        await container.runs.shutdown()
        await container.db.dispose()

    app = FastAPI(
        title="NEXUS API",
        version=settings.version,
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )
    app.state.container = container
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "Last-Event-ID", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Retry-After"],
    )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [{"loc": e.get("loc"), "msg": e.get("msg"), "type": e.get("type")} for e in exc.errors()]
        return JSONResponse(status_code=422, content={"detail": errors})

    app.include_router(system.router, prefix="/api/v1")
    app.include_router(runs.router, prefix="/api/v1")
    app.include_router(governance.router, prefix="/api/v1")
    # Unversioned health aliases for load balancers and legacy clients.
    app.add_api_route("/api/health", system.health, methods=["GET"], include_in_schema=False)
    app.add_api_route("/health", system.health, methods=["GET"], include_in_schema=False)
    setup_tracing(app, settings)
    return app


app = create_app()
