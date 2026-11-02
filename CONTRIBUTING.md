# Contributing to NEXUS

## Workflow

1. Branch from `main` (`feat/…`, `fix/…`, `chore/…`).
2. Make focused changes with tests. Use [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat(api): …`, `fix(web): …`).
3. Run the checks below, open a PR using the template, and get a CODEOWNERS review.
4. `main` is protected: CI must be green (backend, Postgres, evals, contract, frontend, e2e, docker, secrets).

## Local checks

```bash
pip install -r server/requirements-dev.txt && npm ci
pre-commit install                      # optional: run linters on commit
```

```bash
ruff check server evals scripts && ruff format --check server evals scripts && mypy server && pytest --cov
```

```bash
npm run typecheck && npm run lint && npm test && npx playwright test
```

```bash
python -m evals.run_evals
```

## Rules of the road

- **API changes** need `npm run gen:api`, with the regenerated `openapi.json` and `src/api/schema.ts` committed (CI checks this).
- **Database changes** need an Alembic migration. `alembic check` must pass.
- **Prompt changes** need a version bump and live eval results in the PR.
- **Never** add fabricated values to the UI (scores, IDs, latencies). Everything shown must come from the API.
- **Security-sensitive code** (`server/core/security.py`, `server/engine/safety.py`, tenancy) needs tests for the negative path.
- Keep accessibility green: the axe scan in e2e must report no serious or critical violations.
