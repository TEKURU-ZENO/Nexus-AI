"""Prometheus metrics and optional OpenTelemetry / Sentry wiring.

OTel and Sentry are opt-in: install `opentelemetry-exporter-otlp` / `sentry-sdk` and set
OTEL_EXPORTER_OTLP_ENDPOINT / SENTRY_DSN. LangChain/LangGraph tracing to LangSmith is enabled by
the standard LANGSMITH_TRACING / LANGSMITH_API_KEY environment variables.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import structlog
from prometheus_client import Counter, Gauge, Histogram

if TYPE_CHECKING:
    from fastapi import FastAPI

    from server.core.config import Settings

log = structlog.get_logger(__name__)

HTTP_REQUESTS = Counter("nexus_http_requests_total", "HTTP requests", ["method", "route", "status"])
HTTP_LATENCY = Histogram("nexus_http_request_seconds", "HTTP latency", ["method", "route"])
RUNS = Counter("nexus_runs_total", "Mission runs by terminal status", ["status", "simulated"])
RUN_DURATION = Histogram("nexus_run_seconds", "Mission run duration", buckets=(1, 5, 15, 30, 60, 120, 300, 600))
ACTIVE_RUNS = Gauge("nexus_active_runs", "Runs currently executing")
LLM_CALLS = Counter("nexus_llm_calls_total", "LLM calls", ["provider", "outcome"])
LLM_LATENCY = Histogram("nexus_llm_call_seconds", "LLM call latency", ["provider"])
LLM_TOKENS = Counter("nexus_llm_tokens_total", "LLM tokens", ["provider", "direction"])
RUN_COST = Counter("nexus_llm_cost_usd_total", "Estimated LLM spend (USD)")


def setup_tracing(app: FastAPI, settings: Settings) -> None:
    if settings.otel_exporter_otlp_endpoint:
        try:
            from opentelemetry import trace
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
            from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
            from opentelemetry.sdk.resources import Resource
            from opentelemetry.sdk.trace import TracerProvider
            from opentelemetry.sdk.trace.export import BatchSpanProcessor

            provider = TracerProvider(resource=Resource.create({"service.name": "nexus-api"}))
            provider.add_span_processor(
                BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint))
            )
            trace.set_tracer_provider(provider)
            FastAPIInstrumentor.instrument_app(app)
            log.info("telemetry.otel_enabled")
        except ImportError:
            log.warning(
                "telemetry.otel_unavailable",
                hint="pip install opentelemetry-exporter-otlp opentelemetry-instrumentation-fastapi",
            )
    if settings.sentry_dsn:
        try:
            import sentry_sdk

            sentry_sdk.init(
                dsn=settings.sentry_dsn.get_secret_value(),
                environment=settings.environment.value,
                traces_sample_rate=0.1,
            )
            log.info("telemetry.sentry_enabled")
        except ImportError:
            log.warning("telemetry.sentry_unavailable", hint="pip install sentry-sdk")
