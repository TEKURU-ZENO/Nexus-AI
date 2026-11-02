# Committed evaluation results

Files here are produced by CI (`.github/workflows/ablation.yml`) from real model runs and committed through a
pull request, so every number is traceable to a workflow run. Nothing in this folder is hand-written or produced
by the offline simulator (`evals/ablation.py` refuses to write dry runs here).

- `ablation-latest.md`: summary of the most recent debate-vs-single-prompt ablation
- `ablation-<timestamp>-<model>.json`: full per-case outputs, judge verdicts (both orders) and rationales
- `live-eval-<model>.json`: golden-set rubric + LLM-judge scores for the full pipeline on a live model

Interpretation rules (pre-registered in `evals/ablation.py`): "debate wins" only if the lower Wilson 95% bound of
the graph's pairwise win rate is above 0.5 and the exact sign test gives p < 0.05, against both the single-prompt
arm and the compute-matched self-refine arm. Results are specific to the generator and judge models used.
