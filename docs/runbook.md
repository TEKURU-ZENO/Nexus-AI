# NEXUS Operations Runbook

## Deploy

1. Provision Postgres and set `DATABASE_URL=postgresql+asyncpg://…`, `AUTO_CREATE_SCHEMA=false`.
2. Set `ENVIRONMENT=production`, `AUTH_MODE=oidc` with `AUTH_ISSUER`, `AUTH_AUDIENCE` and `AUTH_JWKS_URL`
   (or `jwt` with a 32+ byte `AUTH_JWT_SECRET`), and `CORS_ORIGINS`.
3. Set provider keys, `METRICS_TOKEN`, and optionally `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT` and `LANGSMITH_*`.
4. Containers: the API image runs `alembic upgrade head` on start. Run one Uvicorn worker per container and scale out.
   With more than one instance in `background` mode, see the scaling note in [architecture.md](architecture.md#adr-006-execution-modes).
5. Vercel: `RUN_EXECUTION` defaults to `on_stream`. Use an external Postgres; the SQLite fallback lives in `/tmp` and is ephemeral.

## Health and readiness

- `GET /api/v1/health`: liveness plus provider and database status.
- `GET /api/v1/readyz`: returns 503 when the database is unreachable (use for load-balancer readiness).

## Key metrics (`GET /api/v1/metrics`, Prometheus)

| Metric | Alert when |
|---|---|
| `nexus_runs_total{status="failed"}` rate / all runs | > 5% over 15 min |
| `nexus_llm_calls_total{outcome="error"}` | Sustained increase (provider outage or quota) |
| `nexus_runs_total{simulated="true"}` with live keys configured | Any: all providers are failing |
| `nexus_run_seconds` p95 | > 120s |
| `nexus_llm_cost_usd_total` rate | Exceeds budget forecast |
| `nexus_http_requests_total{status=~"5.."}` | > 1% |

Suggested SLOs: 99.9% API availability, 99% run success (excluding blocked missions), p95 time-to-first-event < 2s.

## Incidents

| Symptom | Likely cause | Action |
|---|---|---|
| All runs simulated | Provider keys invalid or quota exhausted | Check `provider_degraded` events and logs `llm.provider_failed`; rotate keys or switch `LLM_PROVIDERS` order |
| Runs stuck `running` | Worker crashed | The sweeper fails them after `RUN_TIMEOUT_S` + 120s; check logs for `run.swept_stale` |
| 402 on run creation | Org daily spend cap reached | Raise `organizations.daily_spend_usd` for that org or wait for the UTC day rollover |
| 429 responses | Per-user rate limit | Adjust `RUNS_PER_MINUTE`; investigate abuse via the audit log |
| SSE disconnects behind proxy | Proxy buffering or timeouts | Disable buffering and allow long reads (see `deploy/nginx.conf`) |

Every response carries `X-Request-ID`; logs are JSON with the same `request_id`, so you can grep logs from a user report.

## Rotating secrets

- `AUTH_JWT_SECRET` rotation invalidates all tokens. Prefer OIDC, where key rotation is handled by the IdP's JWKS.
- Provider keys can be rotated at any time; in-flight runs fail over to the next provider.

## Prompt and model changes

1. Edit `server/prompts/<agent>.md` and bump its `version:`.
2. Run `python -m evals.run_evals --live --limit 20` locally or trigger the **Live evals** workflow.
3. Attach the summary to the PR. Every run records the prompt versions it used, so regressions are traceable.
