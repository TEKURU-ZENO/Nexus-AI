# NEXUS Architecture

## System overview

```
 Browser (React + TS)
   │  REST  /api/v1/*            (typed client generated from OpenAPI)
   │  SSE   /api/v1/runs/{id}/events   (fetch-based, Authorization header, Last-Event-ID resume)
   ▼
 FastAPI app ── RequestContext middleware (request IDs, security headers, metrics)
   │            Auth (dev | HS256 JWT | OIDC JWKS) → Principal(org, roles) → RBAC
   │            Rate limiter (token bucket) · daily spend cap per org
   ▼
 RunService ── creates Run rows, executes the LangGraph mission graph, appends RunEvents,
   │            fans events out to SSE subscribers, cancels orphaned/timeouts, sweeps stale runs
   ├──► LangGraph MISSION_GRAPH (server/engine/graph.py)
   │       └──► LLMGateway ──► LangChain ChatOpenAI → ChatAnthropic → … → Simulator
   │       └──► SearchTool (Tavily, optional)
   ├──► MemoryStore (org+project scoped, similarity recall, accepted decisions only)
   └──► SQLAlchemy async ──► Postgres (prod) / SQLite (local, tests)
                              runs · run_events · memories · audit_logs · orgs · users · memberships
```

## Request and run lifecycle

1. `POST /api/v1/runs` validates input (Pydantic), checks permission, rate limit and spend cap, inserts the run
   (`queued`), writes an audit entry, and (in `background` mode) starts execution.
2. `execute()` recalls project memory, then streams the graph with `stream_mode=["custom", "values"]`. Every
   `custom` event emitted by a node becomes a `run_events` row with a monotonically increasing `seq` and is
   published to live subscribers.
3. `GET /runs/{id}/events` first replays persisted events after `Last-Event-ID`, then tails live events, sending
   heartbeats every 15s. Duplicate sequence numbers are dropped on both server and client.
4. On completion the run row stores the typed `RunResult`, usage (tokens, cost, calls), providers used, and the
   prompt versions in force.

## Mission graph

| Node | Output schema | Notes |
|---|---|---|
| `guard` | – | Flags injection patterns, blocks harmful missions |
| `plan` (orchestrator) | `MissionPlan` | One question per specialist |
| `specialist` ×3 (parallel `Send`) | `AgentReport` | Researcher may call web search; non-provided URLs are downgraded to `model_knowledge` |
| `critic` | `Critique` | Later rounds only raise unresolved issues |
| `rebuttal` | `Rebuttal` | Concede / defend / revise each challenge |
| `judge` | `JudgeVerdict` | Loops back to `critic` if unresolved and rounds remain |
| `synthesize` | `Directive` | Must carry unresolved issues as risks |
| `score` | `ConfidenceBreakdown` | Deterministic, see `engine/confidence.py` |

Dependencies (gateway, budget, search) are injected through `config["configurable"]["deps"]`, so the graph is pure
and testable; the eval harness runs it directly without HTTP.

## Architecture decision records

### ADR-001: LangGraph for orchestration
*Context.* The original pipeline was a hard-coded sequential loop with string-concatenated context.
*Decision.* Model the run as a LangGraph `StateGraph` with typed state, reducers for parallel merges, `Send` fan-out,
and a conditional debate loop.
*Consequences.* Parallel specialists cut latency. Loops and new nodes are declarative. LangSmith tracing works with no
code changes. We take a dependency on LangGraph's API (pinned; upgrades grouped by Dependabot).

### ADR-002: Structured outputs everywhere
*Decision.* Every LLM call returns a Pydantic model via tool-calling structured output, with one repair retry that
includes the validation error. Free text is never parsed with regexes.
*Consequences.* The UI renders typed sections, confidence can be computed, and evals can score structure.

### ADR-003: Provider gateway with explicit failover and an honest simulator
*Decision.* Providers are tried in configured order. Transport, auth or quota errors move to the next provider and
emit a `provider_degraded` event. The deterministic simulator is the last resort (disable with
`ALLOW_SIMULATOR_FALLBACK=false`). Simulated runs are flagged, confidence-capped at 40, and never written to memory.
*Consequences.* Demos never break, and simulated output can never pass as real analysis.

### ADR-004: Computed confidence
*Decision.* Confidence = mean claim confidence × (0.7 + 0.3·grounding) × (0.6 + 0.4·agreement) × (1 − 0.3·critic
severity) − 0.04·unresolved issues (capped at 0.2). Human accept/reject outcomes are tracked for calibration
(expected calibration error per org).
*Consequences.* The number is explainable and shown with its breakdown. The weights should be re-fit once enough
decided runs exist.

### ADR-005: Event-sourced runs and SSE
*Decision.* Persist every run event and stream over SSE with resume, rather than one long-lived NDJSON response.
*Consequences.* Disconnects are recoverable, runs are replayable for audit, and the UI is a pure reducer over events.

### ADR-006: Execution modes
*Decision.* `RUN_EXECUTION=background` (containers) starts runs on creation. `on_stream` (serverless) executes inside
the SSE request that first claims the queued run through an atomic `UPDATE … WHERE status='queued'`.
Every run has a hard timeout (`RUN_TIMEOUT_S`). A periodic sweeper fails runs older than timeout + grace, which is
safe with many instances.
*Consequences.* Works on Vercel, where work after a response is frozen. For high scale, move `execute()` to a queue
worker (Arq, Celery or Temporal) and swap the in-process `EventBus` for Redis pub/sub. The API contract does not change.

### ADR-007: Multi-tenancy by `org_id`
*Decision.* Identity comes from verified tokens (`org` and `roles` claims). Every tenant-owned query filters on
`org_id`, and cross-tenant access returns 404 (not 403) to prevent ID probing. Users and orgs are provisioned
just-in-time and idempotently under concurrency.
*Next step.* Add Postgres row-level security as defense in depth.

## Known limitations and next steps

- In-process event bus and rate limiter: use Redis when running more than one API instance in `background` mode.
- Memory uses JSON-stored vectors with in-Python cosine similarity (fine for thousands of items per project). Move to
  pgvector for scale.
- OIDC login UI (PKCE redirect) is not built in. The web app accepts a bearer token from your IdP.
- Confidence weights are expert-set. Re-fit them against calibration data.
