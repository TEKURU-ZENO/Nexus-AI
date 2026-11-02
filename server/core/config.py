"""Typed, 12-factor configuration. Every setting comes from the environment (or `server/.env`)."""

from __future__ import annotations

import os
from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parents[1]


class AuthMode(StrEnum):
    DEV = "dev"  # anonymous local principal (owner of the default org); never use in production
    JWT = "jwt"  # HS256 bearer tokens signed with AUTH_JWT_SECRET
    OIDC = "oidc"  # RS256/ES256 bearer tokens verified against the IdP's JWKS


class Environment(StrEnum):
    LOCAL = "local"
    TEST = "test"
    STAGING = "staging"
    PRODUCTION = "production"


def _default_database_url() -> str:
    # Serverless filesystems are read-only except /tmp; prefer a real Postgres there.
    if os.getenv("VERCEL"):
        return "sqlite+aiosqlite:////tmp/nexus.db"
    return f"sqlite+aiosqlite:///{SERVER_DIR / 'data' / 'nexus.db'}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=SERVER_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "NEXUS"
    version: str = "1.0.0"
    environment: Environment = Environment.LOCAL
    log_level: str = "INFO"
    log_json: bool = True

    # --- HTTP ---
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://127.0.0.1:5173", "http://localhost:5173"]
    )

    # --- Persistence ---
    database_url: str = Field(default_factory=_default_database_url)
    auto_create_schema: bool = True  # convenience for local/serverless; use Alembic in prod

    # --- Auth ---
    auth_mode: AuthMode = AuthMode.DEV
    auth_jwt_secret: SecretStr | None = None
    auth_issuer: str | None = None
    auth_audience: str | None = None
    auth_jwks_url: str | None = None
    auth_org_claim: str = "org"
    auth_roles_claim: str = "roles"

    # --- LLM gateway ---
    # Ordered provider chain; first available is primary, others are fallbacks.
    # `simulator` is a deterministic offline provider used when nothing else is configured.
    llm_providers: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["openai", "anthropic"])
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-5-mini"
    anthropic_api_key: SecretStr | None = None
    anthropic_model: str = "claude-sonnet-5-5"
    llm_timeout_s: float = 60.0
    llm_max_retries: int = 2
    llm_max_output_tokens: int = 4000
    llm_temperature: float | None = None
    allow_simulator_fallback: bool = True

    # --- Budgets & limits ---
    run_token_budget: int = 120_000
    org_daily_spend_usd: float = 25.0
    runs_per_minute: int = 6
    mission_max_chars: int = 4000
    debate_max_rounds: int = 2
    run_orphan_timeout_s: float = 30.0
    run_timeout_s: float = 600.0  # hard wall-clock limit per run
    # background: POST /runs starts execution in this process (containers/VMs).
    # on_stream:  the SSE request that streams a queued run also executes it (serverless, e.g. Vercel,
    #             where work after the response is frozen). Claimed atomically so it runs exactly once.
    run_execution: Literal["background", "on_stream"] = Field(
        default_factory=lambda: "on_stream" if os.getenv("VERCEL") else "background"
    )

    # --- Tools ---
    tavily_api_key: SecretStr | None = None
    search_max_results: int = 5

    # --- Memory ---
    memory_min_similarity: float = 0.18
    memory_top_k: int = 3
    use_provider_embeddings: bool = False

    # --- Observability ---
    metrics_token: SecretStr | None = None
    otel_exporter_otlp_endpoint: str | None = None
    sentry_dsn: SecretStr | None = None

    @model_validator(mode="before")
    @classmethod
    def _blank_is_unset(cls, data: Any) -> Any:
        """`KEY=` in an env file means "use the default", not "empty string"."""
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if not (isinstance(v, str) and not v.strip())}
        return data

    @field_validator("cors_origins", "llm_providers", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip().startswith("["):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment in {Environment.PRODUCTION, Environment.STAGING}

    def validate_for_runtime(self) -> None:
        """Fail fast on insecure production configuration."""
        if self.is_production and self.auth_mode is AuthMode.DEV:
            raise RuntimeError("AUTH_MODE=dev is not allowed in staging/production")
        if self.auth_mode is AuthMode.JWT and not self.auth_jwt_secret:
            raise RuntimeError("AUTH_MODE=jwt requires AUTH_JWT_SECRET")
        if self.auth_mode is AuthMode.OIDC and not (self.auth_jwks_url and self.auth_issuer):
            raise RuntimeError("AUTH_MODE=oidc requires AUTH_JWKS_URL and AUTH_ISSUER")


@lru_cache
def get_settings() -> Settings:
    return Settings()
