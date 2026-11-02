# NEXUS — Senior AI Engineering Audit

**Date:** 2026-11-02 · **Scope:** full repository at `01ad89c` (FastAPI backend, React/Vite frontend, Vercel config, docs)
**Verdict:** A strong *hackathon demo* with good product instincts, but **not yet a real multi-agent system**. Several of its core claims (live mode, memory, confidence, synthesis) are partly or entirely simulated. Getting to corporate standard means rebuilding the core engine, adding a real data layer and identity, and putting testing, evals, security and observability in place, in that order.

---

## 1. What the repo actually is

| Layer | Size | Reality |
|---|---|---|
| `server/` (FastAPI) | ~420 LOC | One streaming endpoint. Four agents run **sequentially** (Orchestrator → Researcher → Architect → Strategist), then a Critic pass. Each agent is a single prompt string. |
| `src/main.jsx` | 1,377 LOC, **one file** | The whole UI: landing page, console, Three.js starfield, modals, local "simulation" engine, report builder. |
| `src/styles.css` | 1,446 LOC | One global stylesheet, plus about 20 inline `style={{}}` overrides. |
| Persistence | `server/data/memory.json` + browser `localStorage` | No database. |
| Tests / CI / lint / types | **None** | `typescript` is installed but never used. |

---

## 2. Strengths (keep and build on these)

1. **Clear product thesis.** "Mission → specialist agents → adversarial critique → decision directive" is a clear, demoable idea that sells well. The docs folder (brief, one-pager, demo script) shows real product thinking.
2. **Streaming-first UX.** NDJSON streaming end to end (`server/routes/mission.py`, `runRemoteMission`) is the right base for agent UIs.
3. **Context propagation between agents.** Each agent receives prior outputs (`mission_service.py:emit_agent`), which is the minimum needed for a coherent chain.
4. **Built-in red-teaming.** A dedicated Critic with a "Most Dangerous Assumption / Proof Required" schema is a good pattern that many production agent systems lack.
5. **Graceful degradation.** The app falls back to simulation when there is no key, the provider fails or the API is offline, so the demo never breaks.
6. **Human-in-the-loop.** Accept / Challenge / Refine actions and a Markdown export are the right decision-support model for high-stakes domains.
7. **Simple deploy story.** A single Vercel config serves the static frontend and the Python function, and the Vite proxy needs no environment branching in local dev.
8. **Secrets hygiene basics.** `.env` is git-ignored, `.env.example` exists, and the OpenAI client is created lazily.

---

## 3. Weaknesses, verified and ranked

Severity: **P0** = broken or misleading today · **P1** = blocks production use · **P2** = quality and scale.

### 3.1 Correctness bugs (P0)

| # | Finding | Evidence |
|---|---|---|
| B1 | **Live mode can never be shown.** The frontend calls `/api/health`, but the backend serves `/health`. Verified: `GET /api/health → 404`, so the UI always says "Local Simulation Mode" even when a key is configured. On Vercel, `/health` isn't routed to Python at all. | `src/main.jsx:222`, `server/main.py:23` |
| B2 | **Simulation output ignores the mission.** Fallback text is hard-coded healthcare content. Verified: the mission "Open a bakery in Lisbon" returns *"diagnostic error is expensive…"*. | `mission_service.py:fallback_output` |
| B3 | **Memory gets polluted and leaks between users.** That off-topic fallback is then written to `memory.json` and recalled on later missions. The file is global, so **every user shares one memory**, which is a cross-tenant data leak. | `memory_store.py:remember` |
| B4 | **Thread-unsafe queue.** `asyncio.Queue.put_nowait` is called from a worker thread (`asyncio.to_thread`). `asyncio.Queue` is not thread-safe, which can cause lost wakeups or hangs under load. The task returned by `create_task` is also not kept, so it can be garbage-collected, and it is never cancelled when the client disconnects, so tokens keep burning after the user leaves. | `openai_service.py:31-55` |
| B5 | **Live LLM output gets overwritten by keyword rules.** In live mode the UI throws away the model's decision and replaces it with `if mission includes 'hospital'…` logic. It also relabels sections wrongly: Researcher text appears as "Reasoning", Architect as "Tradeoffs", Strategist as "Execution Plan" and **the Critic's attack as "Success Metrics"**. | `src/main.jsx:390-418` |
| B6 | **Confidence is fabricated.** `confidence: 91` is a hard-coded constant in both backend and frontend. For a decision-support product this is the most damaging trust issue. | `mission_service.py:150`, `main.jsx:153,400` |
| B7 | **Synthesis is not synthesis.** The "directive" is each agent's output cut off at 320 characters, with hard-coded recommendations. No model reconciles the debate. | `mission_service.py:section()` |
| B8 | **Race conditions in run state.** `finally { setTimeout(() => setRunning(false), 18000) }` fires even after a run completes or a new one starts, and there's a separate 45 s timeout. Overlapping runs (for example Challenge right after Run) unlock the UI mid-stream. No `AbortController` is used. | `main.jsx:449-455, 492-498` |
| B9 | **Error signalling through string sniffing.** Provider errors are detected with `delta.startswith("\n[provider warning:")`, and the raw exception text (which may include internal details) is streamed to the client. | `mission_service.py:95, 186` |
| B10 | **Malformed or partial lines crash the stream reader.** `JSON.parse(line)` has no try/catch, and the leftover buffer is never flushed after `done`. | `main.jsx:355-360` |

### 3.2 AI and agent architecture (P1)

- **Not a "mesh".** It is a fixed linear chain with no planning, routing, tool use, retrieval or parallelism. The Orchestrator's "workstreams" have no effect on what runs next.
- **No grounding.** The Researcher has no web search, documents or citations, so every "market signal" is hallucinated. There's also no evidence ledger, even though the UI claims one.
- **No structured outputs.** Agents return free text described in the prompt ("Format with: Risk Level…"), and nothing parses or validates it. Use JSON-schema structured outputs with Pydantic models.
- **Prompt inconsistency.** The system prompt asks for "Risk Level, Reasoning, Recommendation, Confidence", while the user prompt asks for "Risk Level, Observation, Strategic Opportunity…". The two contradict each other.
- **Hard-coded `max_output_tokens=500`** caps reasoning models (the default is `gpt-5`), which can return truncated or empty output. There's no temperature or reasoning-effort control.
- **"Memory" is keyword matching** (`any(word in text)` on words longer than 4 characters) over 20 records. It has no embeddings, no scoping and no relevance threshold.
- **No evals.** There's no way to know whether a prompt change makes plans better or worse.
- **Prompt injection is unmitigated.** User mission and refinement text is inserted raw into every agent prompt and into memory, which then feeds future prompts (stored injection).
- **Single provider, no abstraction.** OpenAI only, with no retries, backoff, timeouts, model fallback or cost tracking.

### 3.3 Security and compliance (P1)

- No authentication, authorization, rate limiting or quotas, so **anyone with the URL can spend your API budget**.
- No input validation: an empty mission is accepted (verified 200), there's no length cap and `mode` is a free string. `refinement: str = None` is also typed incorrectly.
- CORS lists only localhost but sets `allow_credentials=True` with wildcard methods and headers. No security headers (CSP, HSTS).
- Disk persistence on Vercel serverless is read-only or ephemeral (outside `/tmp`), so memory silently fails in production.
- No audit log, PII handling, data retention policy or tenant isolation, all of which matter because the demo vertical is *healthcare*.

### 3.4 Engineering hygiene (P1/P2)

- **`"latest"` for every npm dependency.** Builds aren't reproducible, and a major release of React, Vite or framer-motion can break production overnight. Build tools are also listed under `dependencies`.
- **No tests, CI, linting, formatting, type checking or pre-commit hooks.**
- **A 1,377-line single-file frontend** with ~20 hooks in one custom hook. `zustand` is installed but unused, and so is TypeScript.
- Three copies of the agent catalog (backend agents, frontend `agents`, `stageTemplates`) drift independently.
- About 2.8 MB of PNGs are committed to git. Large unoptimized backgrounds belong in WebP/AVIF or a CDN.
- `allow_credentials` with no cookies, `load_dotenv()` called in two modules, module-level singletons, and no config object.
- Accessibility: icon-only buttons, modal close buttons as `&times;` without labels, no focus trap and no `prefers-reduced-motion` support for the Three.js and framer animations.

### 3.5 Operations (P1)

- No structured logging, request IDs, tracing, token or cost metrics, or error tracking.
- No `/api/health` vs `/readyz` split, no versioned API (`/api/v1`), and no OpenAPI contract shared with the frontend.
- Vercel Python functions have execution time limits, so a 5-agent sequential LLM run can exceed them. Long runs need a job queue with resumable streams.

### 3.6 Product and claims risk

- Marketing copy ("autonomous intelligence operating system", "cognitive mesh", "evidence ledger", "decision locks") goes beyond what the code does. Enterprise buyers and their security reviewers will check, and the gap is a credibility risk. Make every claim in the docs traceable to a feature.

---

## 4. Target architecture

```
                ┌──────────────── Web (React + TS, feature modules, zustand, TanStack Query)
                │                     ▲  SSE / resumable stream (Last-Event-ID)
                ▼                     │
   API Gateway (FastAPI /api/v1) ── AuthN (OIDC/SSO) · RBAC · rate limits · quotas · audit log
                │
        Run Service ──► Job Queue (Redis/Arq or Temporal) ──► Agent Runtime Workers
                │                                             │
                │                       ┌─────────────────────┼──────────────────────┐
                │                       ▼                     ▼                      ▼
                │                 Planner/Orchestrator   Specialist agents      Critic + Judge
                │                 (dynamic DAG, parallel) (typed tools: search,  (structured verdicts,
                │                                          retrieval, calc)      calibrated scores)
                │                       └──────────► Synthesizer (schema-validated Directive + citations)
                ▼
   Postgres (tenants, users, missions, runs, events, decisions)  ·  pgvector (scoped memory)
   Object storage (exports, uploads)  ·  LLM Gateway (multi-provider, retries, caching, cost caps)
   OpenTelemetry → traces/metrics/logs · LLM tracing (prompt, tokens, latency, cost per run)
```

Key design rules:
1. **One source of truth for agents.** Agent definitions (id, role, prompt version, output schema, tools) live in the backend and are served to the UI via `/api/v1/agents`.
2. **Every run is an event-sourced record.** Store the full event stream so runs are replayable, auditable and comparable, and so "trace" modals read from the DB, not from React state.
3. **Typed contracts.** Pydantic models produce OpenAPI, which generates the TS client, and the frontend never hand-shapes reports.
4. **Confidence is computed, not asserted.** Derive it from critic severity, evidence coverage, inter-agent agreement and judge scores, and show how it was derived.

---

## 5. Elevation roadmap

### Phase 0: Stop the bleeding (week 1)
- [ ] Fix B1: serve health at `/api/health` (and keep `/health`).
- [ ] Fix B4: use `loop.call_soon_threadsafe` or the **`AsyncOpenAI`** client natively; keep task references and cancel on client disconnect (`request.is_disconnected()`).
- [ ] Fix B5/B6/B7: stop keyword overrides in the UI and stop hard-coded confidence; label sections by agent until real synthesis exists.
- [ ] Fix B2/B3: make simulation mission-aware or clearly labelled "sample", and **never** write fallback output to memory.
- [ ] Fix B8/B10: `AbortController`, a single run ID, no blind timeouts, guarded JSON parsing.
- [ ] Validate input: `mission` 10–4,000 chars, `mode` as an `Enum`, `refinement: str | None` with a length cap.
- [ ] Pin every dependency (`package-lock` already exists; replace `"latest"` with exact versions, move Vite and plugins to `devDependencies`). Use `uv`/`pip-tools` lockfile for Python.

### Phase 1: Engineering foundation (weeks 2–4)
- [ ] Monorepo layout: `apps/web`, `apps/api`, `packages/contracts`.
- [ ] Migrate the frontend to **TypeScript**; split `main.jsx` into feature modules (`landing/`, `console/`, `report/`, `graph/`), and put state in zustand stores.
- [ ] Tooling: ruff + mypy (strict) + pytest; ESLint + Prettier + Vitest + Playwright; pre-commit hooks.
- [ ] CI (GitHub Actions): lint → typecheck → unit → build → e2e smoke → dependency and secret scanning (Dependabot, CodeQL, gitleaks). Protected `main`, required reviews, conventional commits, CODEOWNERS.
- [ ] 12-factor config via `pydantic-settings`; one `Settings` object.
- [ ] Docker + docker-compose for local parity (api, web, postgres, redis).

### Phase 2: Real AI engine (weeks 4–8)
- [ ] **LLM gateway** abstraction (OpenAI, Anthropic Claude and others) with retries, exponential backoff, timeouts, model fallback, response caching and per-run token or cost budgets.
- [ ] **Structured outputs**: every agent returns a Pydantic schema (`Finding{claim, evidence[], risk, confidence}`); invalid outputs trigger a repair retry.
- [ ] **Planner-driven DAG**: the Orchestrator emits a plan; independent agents run **in parallel** (`asyncio.TaskGroup`); the Critic → Rebuttal → Judge debate runs for N rounds or until convergence.
- [ ] **Grounding and tools**: web search with citations, document upload, RAG over customer docs (pgvector), and a calculator for market sizing. Claims without evidence are flagged as unsupported in the UI.
- [ ] **Real synthesis**: a Synthesizer agent produces the `Directive` (decision, rationale, tradeoffs, phased plan, KPIs, risks with owners) from all findings and the debate transcript.
- [ ] **Memory v2**: per-tenant and per-project scoped, embedding-based retrieval with a relevance threshold, user-visible and deletable. Only *accepted* decisions are committed.
- [ ] **Prompt versioning**: prompts are files with version IDs, and each run records which versions it used.
- [ ] **Prompt-injection defenses**: delimit untrusted input, add an instruction hierarchy, sanitize what's stored in memory, and restrict tool permissions.

### Phase 3: Quality and evaluation (weeks 6–10, continuous)
- [ ] **Golden mission set** (50–200 missions across domains) with rubric-based LLM-as-judge plus human spot checks on specificity, internal consistency, evidence coverage, actionability and critic usefulness.
- [ ] Regression gate in CI: a prompt or model change must not lower eval scores beyond a threshold.
- [ ] **Calibrated confidence**: track predicted confidence against user acceptance and outcome feedback, and publish a calibration curve.
- [ ] Red-team suite: injection, jailbreaks, harmful-domain missions, PII leakage.

### Phase 4: Enterprise platform (weeks 8–14)
- [ ] **Identity**: OIDC/SAML SSO, orgs/workspaces, RBAC (owner, editor, viewer, auditor), SCIM later.
- [ ] **Data**: Postgres with migrations (Alembic), row-level tenant isolation, encryption at rest, retention policies, export and delete (GDPR/DPDP).
- [ ] **Durable runs**: a job queue with resumable SSE (`Last-Event-ID`), cancellation, and a run history that's replayable and comparable server-side.
- [ ] **Governance**: immutable audit log of every decision (who accepted or challenged what, which prompt and model versions), and approval workflows.
- [ ] **Security**: rate limiting, per-org spend caps, CSP and security headers, secret manager, SAST/DAST, and a threat model doc. Plan for **SOC 2 Type II** and **ISO 27001**; add HIPAA-ready controls (BAA, PHI isolation) before selling into healthcare.
- [ ] **Hosting**: move long-running agent work off Vercel functions to containers (Fly, Render, ECS or Cloud Run); keep the static web on the CDN.

### Phase 5: Observability, reliability and polish (continuous)
- [ ] OpenTelemetry traces across API → queue → agent → LLM call; LLM tracing (Langfuse/LangSmith/Arize-style) with per-run tokens, latency and cost.
- [ ] SLOs: p95 time to first token under 2 s, run success rate of 99%+, and error budget alerts. Use Sentry for frontend and backend errors.
- [ ] Accessibility to WCAG 2.2 AA: labelled controls, focus traps, keyboard navigation, `prefers-reduced-motion` (pause Three.js), contrast.
- [ ] Performance: code-split Three.js and the landing page, compress PNGs to WebP/AVIF, set a Lighthouse budget in CI.
- [ ] i18n readiness, versioned public API with SDK, webhooks, and integrations (Slack, Notion, Jira export of the action plan).

---

## 6. Definition of "global corporate standard": exit criteria

| Area | Bar |
|---|---|
| Correctness | No hard-coded AI outputs or scores in live mode; every directive field traces to an agent output and a citation. |
| Quality | Eval suite of 100+ missions gating every prompt or model change; calibration error tracked. |
| Security | SSO + RBAC, tenant isolation tested, rate limits and spend caps, injection red-team passing, SOC 2 controls mapped. |
| Reliability | 99.9% API availability, resumable runs, provider failover, p95 TTFT under 2 s. |
| Engineering | 80%+ backend test coverage on core engine, strict typing on both sides, green CI required to merge, pinned and scanned dependencies. |
| Operability | Traces, metrics and cost per run visible; runbooks; on-call alerts. |
| Trust and UX | Confidence derivation and evidence are visible; users can see, edit and delete memory; WCAG 2.2 AA. |
| Docs | Architecture decision records, threat model, API reference, contributing guide; marketing claims match shipped features. |

---

## 7. Recommended first PR (smallest high-value slice)

1. Health route fix (B1), thread-safe streaming with `AsyncOpenAI` and disconnect cancellation (B4).
2. Request validation and enum modes.
3. Remove UI keyword overrides and hard-coded confidence (B5/B6), and correct the section labels.
4. Don't persist fallback output to memory (B3).
5. Pin dependencies; add ruff, pytest and a minimal GitHub Actions workflow with 5–10 tests covering the stream contract.

This slice makes the product *honest* (live mode works, outputs aren't faked) and creates the safety net (tests and CI) that every later phase depends on.
