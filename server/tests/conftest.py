from __future__ import annotations

import asyncio
import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from server.core.config import AuthMode, Settings
from server.llm.gateway import Provider
from server.main import create_app

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")  # e.g. postgresql+asyncpg://... in CI


async def _reset_schema(url: str) -> None:
    from server.db.models import Base
    from server.db.session import Database

    db = Database(url)
    async with db.engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await db.dispose()


def make_settings(tmp_path: Path, **overrides: Any) -> Settings:
    if TEST_DATABASE_URL:
        asyncio.run(_reset_schema(TEST_DATABASE_URL))
    base: dict[str, Any] = {
        "database_url": TEST_DATABASE_URL or f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
        "environment": "test",
        "auth_mode": AuthMode.DEV,
        "llm_providers": [],
        "openai_api_key": None,
        "anthropic_api_key": None,
        "tavily_api_key": None,
        "runs_per_minute": 1000,
        "run_orphan_timeout_s": 0,
        "log_json": False,
        "log_level": "WARNING",
    }
    base.update(overrides)
    return Settings(_env_file=None, **base)  # type: ignore[call-arg]


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return make_settings(tmp_path)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as c:
        yield c


def make_client(settings: Settings, providers: list[Provider] | None = None) -> TestClient:
    return TestClient(create_app(settings, providers))


def read_sse(
    client: TestClient, run_id: str, headers: dict[str, str] | None = None, after: int | None = None
) -> list[dict[str, Any]]:
    url = f"/api/v1/runs/{run_id}/events" + (f"?after={after}" if after is not None else "")
    events: list[dict[str, Any]] = []
    with client.stream("GET", url, headers=headers or {}) as resp:
        assert resp.status_code == 200, resp.read()
        for line in resp.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))
    return events


MISSION = "Open a bakery in Lisbon that sells gluten-free bread to tourists"
