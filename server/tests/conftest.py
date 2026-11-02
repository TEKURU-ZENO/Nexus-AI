from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from server.core.config import AuthMode, Settings
from server.llm.gateway import Provider
from server.main import create_app


def make_settings(tmp_path: Path, **overrides: Any) -> Settings:
    base: dict[str, Any] = {
        "database_url": f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
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
