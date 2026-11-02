# NEXUS

**A multi-agent decision system with adversarial review.** You describe a mission; NEXUS plans it, runs
specialist agents in parallel, makes a critic attack their findings, has a judge score the debate, and
produces a directive with phases, KPIs, owned risks, and a confidence score that shows how it was computed.

[![CI](https://github.com/TEKURU-ZENO/Nexus-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/TEKURU-ZENO/Nexus-AI/actions/workflows/ci.yml)
[![CodeQL](https://github.com/TEKURU-ZENO/Nexus-AI/actions/workflows/codeql.yml/badge.svg)](https://github.com/TEKURU-ZENO/Nexus-AI/actions/workflows/codeql.yml)

```
START → guard ─┬─ blocked ─────────────────────────────────────────────→ END
               └→ plan → [researcher ‖ architect ‖ strategist] → critic → rebuttal → judge
                                                                   ↑                   │ unresolved &
                                                                   └───────────────────┘ round < max
                                                                                       ↓
                                                                         synthesize → score → END
```

| | |
|---|---|
| **Engine** | [LangGraph](https://langchain-ai.github.io/langgraph/) state graph with parallel fan-out and a bounded debate loop |
| **Models** | LangChain gateway: OpenAI → Anthropic failover, structured outputs, repair retries, token budgets, cost tracking |
| **Grounding** | Optional web search (Tavily) with citations; hallucinated URLs are stripped |
| **Trust** | Computed confidence, simulated output clearly labelled and never stored, prompt-injection defenses |
| **Platform** | FastAPI · SQLAlchemy (Postgres/SQLite) · Alembic · resumable SSE · JWT/OIDC · RBAC · audit log |
| **Web** | React 19 + TypeScript · zustand · generated API types · WCAG 2.1 AA checked in CI |
| **Quality** | 49 backend tests · 9 unit + 4 e2e frontend tests · 50-mission eval suite + red team · strict mypy |

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r server/requirements-dev.txt
npm ci
cp server/.env.example server/.env    # optional: add OPENAI_API_KEY / ANTHROPIC_API_KEY
```

```bash
npm run dev:server    # API on http://127.0.0.1:8000  (docs at /api/docs)
```

```bash
npm run dev           # web on http://127.0.0.1:5173
```

Without API keys NEXUS runs on a deterministic **simulator**. It produces mission-specific but
template-grade output, labels it as simulated, caps its confidence at 40, and never writes it to memory.

### Full stack with Postgres

```bash
docker compose up --build      # → http://localhost:8080
```

## How a run works

1. **Guard**: the mission is normalised, checked for prompt injection (flagged) and harmful intent (blocked).
2. **Plan**: the orchestrator restates the mission as a measurable objective and assigns one question per specialist.
3. **Specialists** (parallel): researcher (with web search when configured), architect, and strategist each return
   typed findings: claim, rationale, evidence, risk, calibrated confidence, recommendation.
4. **Debate**: the critic names the most dangerous assumption and challenges specific claims; the team concedes,
   defends or revises; the judge scores agreement and decides whether another round is needed (max `DEBATE_MAX_ROUNDS`).
5. **Synthesis**: a directive with decision, rationale, tradeoffs, phased plan with exit criteria, KPIs, and risks with owners.
6. **Confidence**: computed from claim confidence × external grounding × post-debate agreement × critic severity −
   unresolved issues. The UI shows the breakdown.
7. **Decision**: *Accept* commits the decision to project memory (live runs only), *Challenge* opens a linked
   refinement run that targets the unresolved issues, *Reject* records the outcome. Every action is audited and feeds
   the calibration report (`GET /api/v1/calibration`).

Every event is persisted with a sequence number, so streams resume after disconnects (`Last-Event-ID`), runs can be
replayed (`GET /runs/{id}/events/log`), and abandoned runs are cancelled to stop spending tokens.

## Configuration

All settings are environment variables. [`server/.env.example`](server/.env.example) documents every one. The most important:

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDERS` | `openai,anthropic` | Ordered failover chain (keys that are unset are skipped) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | – | Enable live providers |
| `TAVILY_API_KEY` | – | Enable grounded web research |
| `DATABASE_URL` | SQLite in `server/data` | Use `postgresql+asyncpg://…` in production |
| `AUTH_MODE` | `dev` | `jwt` or `oidc` in staging/production (`dev` is refused there) |
| `RUN_TOKEN_BUDGET` / `ORG_DAILY_SPEND_USD` / `RUNS_PER_MINUTE` | 120k / $25 / 6 | Cost and abuse controls |
| `RUN_EXECUTION` | `background` (`on_stream` on Vercel) | Where runs execute; see [architecture](docs/architecture.md) |
| `LANGSMITH_TRACING` | `false` | Trace every graph node and LLM call in LangSmith |

## Development

| Task | Command |
|---|---|
| Backend tests (+coverage) | `pytest --cov` |
| Backend lint / types | `ruff check server evals scripts && ruff format --check server && mypy server` |
| Frontend checks | `npm run typecheck && npm run lint && npm test` |
| End-to-end + accessibility | `npx playwright test` |
| Evals (simulator, CI gate) | `python -m evals.run_evals` |
| Evals (live models) | `python -m evals.run_evals --live --limit 20` |
| Regenerate API types | `npm run gen:api` |
| New DB migration | `alembic revision --autogenerate -m "…"` then `alembic upgrade head` |

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and review rules.

## Documentation

- [Engineering audit and roadmap](docs/ENGINEERING_AUDIT.md), including implementation status
- [Architecture and decision records](docs/architecture.md)
- [Threat model](docs/threat-model.md)
- [Operations runbook](docs/runbook.md)
- [Security policy](SECURITY.md)
- API reference: `/api/docs` (OpenAPI at `/api/openapi.json`, committed as [`openapi.json`](openapi.json))
- Product material: [`docs/`](docs/) (brief, one-pager, demo script, user flow)

## Project layout

```
server/
  api/v1/        HTTP routes (runs, governance, system)
  core/          config, auth/RBAC, rate limiting, logging, telemetry
  engine/        LangGraph mission graph, confidence, safety
  llm/           provider gateway (LangChain) and offline simulator
  memory/        scoped long-term memory
  prompts/       versioned agent prompts (Markdown)
  services/      run lifecycle, audit, tenancy, export
  db/ migrations/  SQLAlchemy models and Alembic migrations
  tests/
evals/           golden missions, red-team set, rubric, LLM judge, runner
src/             React + TypeScript app (api/, components/, store/, lib/)
e2e/             Playwright end-to-end and axe accessibility tests
```

---

## Codex Implementation Attribution

NEXUS was developed in collaboration with Codex (using the Antigravity developer agent) to build, configure, and secure the platform. Codex facilitated:

1. **Mono-Repo Vercel Deployment Scaffolding**: Designed the unified `vercel.json` routing matrix, linking static React/Vite builds and Python serverless functions under a single `/api` mapping.
2. **Local Development Proxy Routing**: Configured the `vite.config.js` proxy routing rules to map `/api` to localhost ports, eliminating environment branching bugs and localhost hardcoding.
3. **Sequential Chain-of-Thought Pipeline**: Engineered the downstream agent prompts in `server/services/mission_service.py` to propagate context, transforming isolated agent runs into a collaborative multi-agent mesh.
4. **Resilient Fail-Safe Error Interceptor**: Created stream interceptors to detect OpenAI API warning/quota failures, triggering high-fidelity simulation fallback states dynamically.
5. **Interactive UI Features**: Assisted in constructing components for deep-dive cognitive traces, side-by-side plan comparison, and user refinement feedback loops.

