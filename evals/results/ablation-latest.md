# Ablation: debate graph vs single prompt

- Generated: 2026-11-03T00:46:12.096459+00:00  
- Generator: `ollama:ollama/qwen2.5:3b` · Judge: `ollama:ollama/phi4:14b`  
- Cases scored: 15 / 15 (errors: 0) · debate rounds ≤ 2 · web search: False

**Verdict:** Inconclusive: the judge failed validity checks (position_bias, score_spread), so pairwise results cannot support any conclusion about debate vs single prompt.

## Judge validity (self-audit)

| Check | Value | Rule | Pass |
|---|---|---|---|
| position_bias | 0.8222 | decisive verdicts choosing position A within [0.25, 0.75] | False |
| score_spread | 0.4157 | std of absolute overall scores >= 0.5 | False |
| known_answer_probe | 0.9333 | prefers on-topic over off-topic directive (both orders) >= 0.8 | True |

Raw pairwise verdicts (both orders, overall): {'A': 74, 'B': 16, 'tie': 0}

## Pairwise (blind, both orders; overall)

| Comparison | Wins | Losses | Ties | Win rate (decisive) | Wilson 95% | Sign test p | Significant |
|---|---|---|---|---|---|---|---|
| graph vs single | 3 | 3 | 9 | 0.5 | [0.1876, 0.8124] | 1.0 | no |
| graph vs refine | 2 | 4 | 9 | 0.3333 | [0.0968, 0.7] | 0.6875 | no |
| refine vs single | 2 | 2 | 11 | 0.5 | [0.15, 0.85] | 1.0 | no |

## Per-arm scores and cost

| Arm | Rubric (neutral) | Judge overall (1-10) | LLM calls | Tokens | Seconds | Cost USD |
|---|---|---|---|---|---|---|
| single | 0.9516 | 7.0 | 1.0 | 900 | 79.5 | 0.0 |
| refine | 0.9436 | 6.87 | 2.0 | 2471 | 172.2 | 0.0 |
| graph | 0.9647 | 6.47 | 10.6 | 23603 | 1252.3 | 0.0 |

## Score differences (paired bootstrap 95% CI)

| Comparison | Rubric diff | Judge overall diff |
|---|---|---|
| graph vs single | 0.0131 [-0.0087, 0.0359] | -0.5333 [-0.8, -0.2667] |
| graph vs refine | 0.0211 [-0.0008, 0.0464] | -0.4 [-0.6667, -0.1333] |
| refine vs single | -0.008 [-0.0294, 0.0127] | -0.1333 [-0.3333, 0.0] |

Method: see `evals/ablation.py` docstring. Raw per-case outputs and judge rationales are in the JSON file next to this report.
