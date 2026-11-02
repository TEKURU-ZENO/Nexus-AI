# Ablation: debate graph vs single prompt

- Generated: 2026-11-02T20:31:07.820243+00:00  
- Generator: `ollama:ollama/qwen2.5:3b` · Judge: `ollama:ollama/llama3.1:8b`  
- Cases scored: 15 / 15 (errors: 0) · debate rounds ≤ 2 · web search: False

**Verdict:** Inconclusive: the judge failed validity checks (position_bias, score_spread), so pairwise results cannot support any conclusion about debate vs single prompt.

## Judge validity (self-audit)

| Check | Value | Rule | Pass |
|---|---|---|---|
| position_bias | 0.8778 | decisive verdicts choosing position A within [0.25, 0.75] | False |
| score_spread | 0.0 | std of absolute overall scores >= 0.5 | False |
| known_answer_probe | None | prefers on-topic over off-topic directive (both orders) >= 0.8 | None |

Raw pairwise verdicts (both orders, overall): {'A': 79, 'B': 11, 'tie': 0}

## Pairwise (blind, both orders; overall)

| Comparison | Wins | Losses | Ties | Win rate (decisive) | Wilson 95% | Sign test p | Significant |
|---|---|---|---|---|---|---|---|
| graph vs single | 1 | 0 | 14 | 1.0 | [0.2065, 1.0] | 1.0 | no |
| graph vs refine | 4 | 1 | 10 | 0.8 | [0.3755, 0.9638] | 0.375 | no |
| refine vs single | 3 | 2 | 10 | 0.6 | [0.2307, 0.8824] | 1.0 | no |

## Per-arm scores and cost

| Arm | Rubric (neutral) | Judge overall (1-10) | LLM calls | Tokens | Seconds | Cost USD |
|---|---|---|---|---|---|---|
| single | 0.9603 | 8.0 | 1.0 | 927 | 65.5 | 0.0 |
| refine | 0.9488 | 8.0 | 2.0 | 2355 | 126.8 | 0.0 |
| graph | 0.9647 | 8.0 | 10.8 | 22337 | 843.0 | 0.0 |

## Score differences (paired bootstrap 95% CI)

| Comparison | Rubric diff | Judge overall diff |
|---|---|---|
| graph vs single | 0.0043 [-0.015, 0.02] | 0.0 [0.0, 0.0] |
| graph vs refine | 0.0158 [-0.0079, 0.0391] | 0.0 [0.0, 0.0] |
| refine vs single | -0.0115 [-0.0323, 0.0098] | 0.0 [0.0, 0.0] |

Method: see `evals/ablation.py` docstring. Raw per-case outputs and judge rationales are in the JSON file next to this report.
