# NEXUS Threat Model (STRIDE)

**Assets:** customer missions and decisions (confidential strategy), project memory, provider API keys,
organisation spend, audit trail integrity.
**Trust boundaries:** browser ↔ API, API ↔ LLM providers / search, API ↔ database, user text ↔ model instructions.

| Threat | Example | Mitigations in place | Residual risk / next step |
|---|---|---|---|
| **S**poofing | Forged tokens | JWT signature, `exp`, `iss` and `aud` verification; OIDC via JWKS; `dev` auth refused in staging/prod | Add mTLS for service-to-service calls |
| **T**ampering | Altering run history | Append-only `audit_logs`; events immutable after write | DB-level `REVOKE UPDATE, DELETE` on `audit_logs` for the app role |
| **R**epudiation | "I never accepted that decision" | Audit entries for create, cancel, decide and memory delete, with actor and detail | Ship logs to WORM storage |
| **I**nformation disclosure | Cross-tenant reads | `org_id` filter on every query; 404 on foreign IDs; tests cover isolation | Postgres RLS as defense in depth |
| | System prompt leakage | Data-handling rules; rubric checks directives for prompt fragments; red-team cases | Expand red-team corpus |
| | Secrets in logs | Provider errors logged by type only; `SecretStr` settings; secret scanning in CI | – |
| **D**enial of service / cost | Token exhaustion | Per-run token budget, per-org daily spend cap, per-user rate limit, run timeout, orphan cancellation | Redis-backed limits for multi-instance |
| **E**levation of privilege | Viewer creating runs or deleting memory | Permission checks on every route (RBAC matrix in `core/security.py`); tests | Periodic access review |
| **Prompt injection** | "Ignore previous instructions…" in a mission | Untrusted text fenced in tagged blocks, fence-closing tags neutralised, injection heuristics flagged to the user and the critic, memory sanitised before storage, only accepted live decisions stored | Heuristics are bypassable; consider a classifier model |
| **Harmful use** | Weapons or malware planning | Pattern-based blocking at the `guard` node; runs marked failed | Add a provider moderation endpoint |
| **Hallucinated evidence** | Fake URLs or stats | Web evidence must match a search result URL or is downgraded; confidence penalises ungrounded claims | Add claim-level citation checking |
| **Supply chain** | Malicious dependency | Pinned versions, `pip-audit`, `npm audit`, Dependabot, CodeQL | SBOM generation and image signing |

## Data handling

- Missions, results and events are stored in the configured database. Encryption at rest is the database's
  responsibility (enable it on managed Postgres).
- Mission text is sent to the configured LLM providers and to Tavily (when enabled). Review their data-retention
  terms; for regulated data (for example PHI), use providers under a BAA/DPA and disable search.
- Deletion: memory items can be deleted by admins via the API. Run deletion and retention jobs are on the roadmap.
