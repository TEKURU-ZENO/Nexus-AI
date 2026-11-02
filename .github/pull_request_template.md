## Summary

<!-- What changes and why. Link the issue. -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Prompt / model change (requires eval results below)
- [ ] Refactor / chore
- [ ] Docs

## Checklist

- [ ] Tests added or updated; `pytest`, `npm test` and `npx playwright test` pass locally
- [ ] `ruff`, `mypy`, `npm run lint`, `npm run typecheck` are clean
- [ ] API changed → ran `npm run gen:api` and committed `openapi.json` + `src/api/schema.ts`
- [ ] Schema changed → added an Alembic migration (`alembic revision --autogenerate`)
- [ ] Prompt changed → bumped its `version:` and attached `python -m evals.run_evals --live` results
- [ ] No secrets, PII, or customer data in code, fixtures, or logs
- [ ] Docs updated (README / docs/*) where behaviour changed

## Eval results (prompt/model changes only)

<!-- Paste the summary block from evals/reports/latest.json -->
