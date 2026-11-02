# Security Policy

## Reporting a vulnerability

Please **do not open public issues** for security problems. Report privately through
[GitHub Security Advisories](https://github.com/TEKURU-ZENO/Nexus-AI/security/advisories/new) with steps to
reproduce, impact, and affected version. We aim to acknowledge reports within 3 business days and to provide a fix
or mitigation plan within 30 days for high-severity issues.

## Supported versions

Only the latest release on `main` receives security fixes.

## Scope

In scope: the API (`server/`), the web app (`src/`), deployment configuration, and prompt-injection or data-isolation
weaknesses. See [docs/threat-model.md](docs/threat-model.md) for known risks and mitigations.

## Hardening checklist for deployers

- `ENVIRONMENT=production` with `AUTH_MODE=oidc` (or `jwt`); never `dev`.
- Postgres with TLS and encryption at rest; `AUTO_CREATE_SCHEMA=false`; migrations via Alembic.
- Set `METRICS_TOKEN`, restrict `CORS_ORIGINS`, and terminate TLS in front of the API.
- Configure `ORG_DAILY_SPEND_USD`, `RUN_TOKEN_BUDGET` and `RUNS_PER_MINUTE` for your usage.
- Use LLM providers under a DPA/BAA appropriate to your data; disable web search for sensitive missions.
