from __future__ import annotations

from pathlib import Path

import pytest

from server.core.config import AuthMode, Environment
from server.core.security import issue_dev_token
from server.tests.conftest import MISSION, make_client, make_settings, read_sse


def _jwt_settings(tmp_path: Path, **kw: object):
    return make_settings(tmp_path, **{"auth_mode": AuthMode.JWT, "auth_jwt_secret": "x" * 40, **kw})


def _auth(settings, sub: str, org: str, roles: list[str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {issue_dev_token(settings, subject=sub, org=org, roles=roles)}"}


def test_jwt_mode_requires_valid_token(tmp_path: Path) -> None:
    s = _jwt_settings(tmp_path)
    with make_client(s) as c:
        assert c.get("/api/v1/runs").status_code == 401
        assert c.get("/api/v1/runs", headers={"Authorization": "Bearer garbage"}).status_code == 401
        assert c.get("/api/v1/runs", headers=_auth(s, "u1", "acme", ["viewer"])).status_code == 200
        assert c.get("/api/v1/health").status_code == 200  # health stays public


def test_expired_and_wrong_secret_tokens_rejected(tmp_path: Path) -> None:
    s = _jwt_settings(tmp_path)
    other = _jwt_settings(tmp_path / "o", auth_jwt_secret="y" * 40)
    with make_client(s) as c:
        assert c.get("/api/v1/runs", headers=_auth(other, "u", "acme", ["owner"])).status_code == 401
        expired = issue_dev_token(s, subject="u", org="acme", roles=["owner"], ttl_s=-10)
        assert c.get("/api/v1/runs", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_rbac_viewer_cannot_create_or_delete(tmp_path: Path) -> None:
    s = _jwt_settings(tmp_path)
    viewer = _auth(s, "v", "acme", ["viewer"])
    with make_client(s) as c:
        assert c.post("/api/v1/runs", json={"mission": MISSION}, headers=viewer).status_code == 403
        assert c.get("/api/v1/audit", headers=viewer).status_code == 403
        assert c.delete("/api/v1/memory/abc", headers=viewer).status_code == 403
        me = c.get("/api/v1/me", headers=viewer).json()
        assert me["roles"] == ["viewer"] and "run:create" not in me["permissions"]


def test_tenant_isolation(tmp_path: Path) -> None:
    s = _jwt_settings(tmp_path)
    a, b = _auth(s, "alice", "acme", ["editor"]), _auth(s, "bob", "globex", ["owner"])
    with make_client(s) as c:
        run = c.post("/api/v1/runs", json={"mission": MISSION}, headers=a).json()
        read_sse(c, run["id"], headers=a)
        assert c.get(f"/api/v1/runs/{run['id']}", headers=b).status_code == 404
        assert c.get(f"/api/v1/runs/{run['id']}/events", headers=b).status_code == 404
        assert c.get(f"/api/v1/runs/{run['id']}/export.md", headers=b).status_code == 404
        assert c.post(f"/api/v1/runs/{run['id']}/decision", json={"status": "accepted"}, headers=b).status_code == 404
        assert c.get("/api/v1/runs", headers=b).json() == []
        assert all(e["actor"] == "bob" for e in c.get("/api/v1/audit", headers=b).json())


def test_rate_limit_returns_429(tmp_path: Path) -> None:
    s = make_settings(tmp_path, runs_per_minute=2)
    with make_client(s) as c:
        codes = [c.post("/api/v1/runs", json={"mission": MISSION}).status_code for _ in range(3)]
        assert codes == [201, 201, 429]


def test_daily_spend_cap(tmp_path: Path) -> None:
    from server.tests.fakes import FakeProvider

    s = make_settings(tmp_path, org_daily_spend_usd=0.0001)
    with make_client(s, [FakeProvider(tokens=(10_000, 10_000))]) as c:
        run = c.post("/api/v1/runs", json={"mission": MISSION}).json()
        read_sse(c, run["id"])
        assert c.post("/api/v1/runs", json={"mission": MISSION}).status_code == 402


def test_production_refuses_dev_auth(tmp_path: Path) -> None:
    s = make_settings(tmp_path, environment=Environment.PRODUCTION)
    with pytest.raises(RuntimeError, match="not allowed"):
        s.validate_for_runtime()


def test_dev_token_endpoint_disabled_outside_jwt_mode(tmp_path: Path) -> None:
    with make_client(make_settings(tmp_path)) as c:
        assert c.post("/api/v1/auth/dev-token", json={"subject": "a", "org": "b"}).status_code == 404


def test_blank_env_values_fall_back_to_defaults(tmp_path: Path) -> None:
    env = tmp_path / ".env"
    env.write_text("DATABASE_URL=\nOPENAI_API_KEY=\nAUTH_MODE=dev   # comment\nLLM_PROVIDERS=openai, anthropic\n")
    from server.core.config import Settings

    s = Settings(_env_file=env)  # type: ignore[call-arg]
    assert s.database_url.startswith("sqlite")
    assert s.openai_api_key is None
    assert s.auth_mode is AuthMode.DEV
    assert s.llm_providers == ["openai", "anthropic"]
