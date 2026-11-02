from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Response, status
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import BaseModel, Field
from sqlalchemy import text

from server.agents import AGENTS
from server.api.deps import ContainerDep, PrincipalDep
from server.core.config import AuthMode
from server.core.security import issue_dev_token
from server.schemas.api import AgentInfo, HealthResponse, Me

router = APIRouter(tags=["system"])


async def _health(container: ContainerDep) -> HealthResponse:
    db_ok = True
    try:
        async with container.db.sessionmaker() as s:
            await s.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        db_ok = False
    return HealthResponse(
        status="online" if db_ok else "degraded",
        system=container.settings.app_name,
        version=container.settings.version,
        live_providers=container.gateway.live_provider_names,
        simulator_only=container.gateway.simulator_only,
        auth_mode=container.settings.auth_mode.value,
        database="ok" if db_ok else "error",
    )


@router.get("/health", response_model=HealthResponse)
async def health(container: ContainerDep) -> HealthResponse:
    return await _health(container)


@router.get("/readyz", response_model=HealthResponse)
async def readyz(container: ContainerDep, response: Response) -> HealthResponse:
    result = await _health(container)
    if result.database != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return result


@router.get("/me", response_model=Me)
async def me(principal: PrincipalDep) -> Me:
    return Me(
        user_id=principal.user_id,
        email=principal.email,
        org_id=principal.org_id,
        roles=sorted(r.value for r in principal.roles),
        permissions=sorted(p.value for p in principal.permissions),
    )


@router.get("/agents", response_model=list[AgentInfo])
async def agents() -> list[AgentInfo]:
    return [
        AgentInfo(id=a.id, name=a.name, role=a.role, description=a.description, prompt_version=a.prompt_version)
        for a in AGENTS
    ]


@router.get("/metrics", include_in_schema=False)
async def metrics(container: ContainerDep, authorization: Annotated[str | None, Header()] = None) -> Response:
    token = container.settings.metrics_token
    if token and authorization != f"Bearer {token.get_secret_value()}":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "metrics token required")
    if not token and container.settings.is_production:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


class DevTokenRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    org: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    roles: list[str] = Field(default_factory=lambda: ["editor"])


@router.post("/auth/dev-token", include_in_schema=False)
async def dev_token(body: DevTokenRequest, container: ContainerDep) -> dict[str, str]:
    s = container.settings
    if s.is_production or s.auth_mode is not AuthMode.JWT:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return {
        "access_token": issue_dev_token(s, subject=body.subject, org=body.org, roles=body.roles),
        "token_type": "bearer",
    }
