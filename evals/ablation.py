"""Ablation: does the critic/rebuttal/judge debate beat one good prompt?

Three arms run on the same missions, with the same model, the same output schema (`Directive`), the same
mode guidance, and the same safety rules:

    single   one strong call that writes the directive directly
    refine   compute-matched control: draft, then self-critique and revise (2 calls)
    graph    the full NEXUS LangGraph pipeline (plan → parallel specialists → debate → synthesis)

`refine` separates "debate helps" from "more calls help". If the graph only beats `single` but not `refine`,
the win comes from extra compute, not from structured adversarial debate.

Scoring (all on the final directive only, so no arm gets credit for its own process):
  * blind pairwise LLM judge, run in both A/B orders; only verdicts consistent across orders count as wins
  * absolute LLM judge scores (1-10) per arm
  * the arm-neutral deterministic rubric

Statistics: win rate over decisive pairs with a Wilson 95% CI, an exact two-sided sign test, and paired
bootstrap CIs on score differences. Pre-registered headline rule: "debate wins" only if the Wilson lower bound
of graph-vs-X overall win rate is above 0.5 *and* the sign test p < 0.05.

Usage:
    python -m evals.ablation --limit 12                       # uses LLM_PROVIDERS / OLLAMA_MODEL etc.
    python -m evals.ablation --limit 12 --shard 0/4 --out part0.json
    python -m evals.ablation --merge part*.json --results-dir evals/results
    python -m evals.ablation --dry-run --limit 3              # plumbing check with the simulator, no claims
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import platform
import random
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from statistics import fmean
from typing import Any, Literal

from pydantic import BaseModel, Field

from evals.rubric import neutral_total, score_directive
from server.core.config import Settings, get_settings
from server.engine.graph import MISSION_GRAPH, EngineDeps, MissionState, _context_block
from server.engine.safety import DATA_HANDLING_RULES, fence
from server.llm.gateway import Budget, LLMGateway, build_providers
from server.prompts import all_prompt_versions
from server.schemas.agents import Directive
from server.tools.search import SearchTool

ROOT = Path(__file__).resolve().parent
PROMPTS = ROOT / "prompts"
ARMS = ("single", "refine", "graph")
COMPARISONS = (("graph", "single"), ("graph", "refine"), ("refine", "single"))
DIMENSIONS = ("decision_quality", "specificity", "feasibility", "risk_coverage", "overall")
Choice = Literal["A", "B", "tie"]


def _prompt(name: str) -> tuple[str, str]:
    raw = (PROMPTS / f"{name}.md").read_text(encoding="utf-8")
    _, header, body = raw.split("---", 2)
    version = next(line.split(":", 1)[1].strip() for line in header.splitlines() if line.startswith("version"))
    return version, body.strip()


class PairwiseVerdict(BaseModel):
    decision_quality: Choice
    specificity: Choice
    feasibility: Choice
    risk_coverage: Choice
    overall: Choice
    rationale: str = Field(description="Two or three sentences explaining the overall choice.")


class AbsoluteScores(BaseModel):
    decision_quality: int = Field(ge=1, le=10)
    specificity: int = Field(ge=1, le=10)
    feasibility: int = Field(ge=1, le=10)
    risk_coverage: int = Field(ge=1, le=10)
    overall: int = Field(ge=1, le=10)


# ----------------------------------------------------------------------------------- generation


def _state(case: dict[str, Any]) -> MissionState:
    return {
        "mission": case["mission"],
        "mode": case.get("mode", "Strategic Planning"),
        "refinement": case.get("refinement"),
        "memory": [],
    }


async def _arm_single(gw: LLMGateway, case: dict[str, Any], budget: Budget) -> Directive:
    _, text = _prompt("baseline_single")
    out = await gw.structured(
        Directive,
        system=f"{text}\n\n{DATA_HANDLING_RULES}",
        user=_context_block(_state(case)) + "\n\nWrite the directive.",
        budget=budget,
        sim_context=dict(_state(case)),
    )
    return out.value


async def _arm_refine(gw: LLMGateway, case: dict[str, Any], budget: Budget) -> Directive:
    draft = await _arm_single(gw, case, budget)
    _, text = _prompt("baseline_revise")
    out = await gw.structured(
        Directive,
        system=f"{text}\n\n{DATA_HANDLING_RULES}",
        user=f"{_context_block(_state(case))}\n\nYour draft directive:\n{draft.model_dump_json()}\n\nReturn the improved directive.",
        budget=budget,
        sim_context=dict(_state(case)),
    )
    return out.value


async def _arm_graph(gw: LLMGateway, case: dict[str, Any], budget: Budget, settings: Settings) -> Directive:
    deps = EngineDeps(gateway=gw, budget=budget, search=SearchTool(settings), max_rounds=settings.debate_max_rounds)
    final: dict[str, Any] = await MISSION_GRAPH.ainvoke(
        _state(case), config={"configurable": {"deps": deps}, "recursion_limit": 40}
    )
    directive = final.get("directive")
    if directive is None:
        raise RuntimeError("graph produced no directive")
    return directive  # type: ignore[no-any-return]


async def generate(gw: LLMGateway, case: dict[str, Any], arm: str, settings: Settings) -> dict[str, Any]:
    budget = Budget(settings.run_token_budget)
    started = time.perf_counter()
    try:
        if arm == "single":
            directive = await _arm_single(gw, case, budget)
        elif arm == "refine":
            directive = await _arm_refine(gw, case, budget)
        else:
            directive = await _arm_graph(gw, case, budget, settings)
        error = None
    except Exception as exc:  # noqa: BLE001 - recorded per case, never silently substituted
        directive, error = None, f"{type(exc).__name__}: {str(exc)[:300]}"
    return {
        "directive": directive.model_dump(mode="json") if directive else None,
        "error": error,
        "seconds": round(time.perf_counter() - started, 2),
        "llm_calls": budget.calls,
        "input_tokens": budget.input_tokens,
        "output_tokens": budget.output_tokens,
        "cost_usd": round(budget.cost_usd, 6),
    }


# ----------------------------------------------------------------------------------- judging


def _flip(choice: str) -> str:
    return {"A": "B", "B": "A"}.get(choice, "tie")


def consolidate(first: dict[str, str], second_swapped: dict[str, str]) -> dict[str, str]:
    """first: X shown as A. second_swapped: X shown as B. Returns per-dimension 'win'|'loss'|'tie' for X.

    A win requires the judge to prefer X in *both* orders; anything inconsistent is a tie (position bias)."""
    out = {}
    for dim in DIMENSIONS:
        a, b = first[dim], _flip(second_swapped[dim])
        out[dim] = "win" if a == b == "A" else "loss" if a == b == "B" else "tie"
    return out


async def judge_pair(judge: LLMGateway, case: dict[str, Any], x: dict[str, Any], y: dict[str, Any]) -> dict[str, Any]:
    _, text = _prompt("pairwise_judge")
    system = text

    async def ask(a: dict[str, Any], b: dict[str, Any]) -> dict[str, str]:
        user = (
            f"{fence('mission', case['mission'])}\nMission mode: {case.get('mode', 'Strategic Planning')}\n\n"
            f"Directive A:\n{fence('directive_a', json.dumps(a))}\n\nDirective B:\n{fence('directive_b', json.dumps(b))}"
        )
        v = await judge.structured(PairwiseVerdict, system=system, user=user, budget=Budget(10**7), sim_context={})
        return v.value.model_dump()

    first = await ask(x, y)
    second = await ask(y, x)
    return {"outcome": consolidate(first, second), "raw": [first, second]}


async def judge_absolute(judge: LLMGateway, case: dict[str, Any], d: dict[str, Any]) -> dict[str, int]:
    _, text = _prompt("absolute_judge")
    user = f"{fence('mission', case['mission'])}\nMission mode: {case.get('mode')}\n\nDirective:\n{fence('directive', json.dumps(d))}"
    v = await judge.structured(AbsoluteScores, system=text, user=user, budget=Budget(10**7), sim_context={})
    return v.value.model_dump()


# ----------------------------------------------------------------------------------- statistics


def wilson(successes: int, n: int, z: float = 1.96) -> tuple[float | None, float | None]:
    if n == 0:
        return None, None
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return round(centre - half, 4), round(centre + half, 4)


def sign_test(wins: int, losses: int) -> float | None:
    n = wins + losses
    if n == 0:
        return None
    k = min(wins, losses)
    p = sum(math.comb(n, i) for i in range(k + 1)) / 2**n
    return round(min(1.0, 2 * p), 6)


def bootstrap_mean_diff(diffs: list[float], iters: int = 5000, seed: int = 7) -> dict[str, float | None]:
    if not diffs:
        return {"mean": None, "ci_low": None, "ci_high": None}
    rng = random.Random(seed)
    means = sorted(fmean(rng.choices(diffs, k=len(diffs))) for _ in range(iters))
    return {
        "mean": round(fmean(diffs), 4),
        "ci_low": round(means[int(0.025 * iters)], 4),
        "ci_high": round(means[int(0.975 * iters)], 4),
    }


def summarise(cases: list[dict[str, Any]]) -> dict[str, Any]:
    ok = [c for c in cases if all(c["arms"][a]["directive"] for a in ARMS)]
    summary: dict[str, Any] = {
        "cases_total": len(cases),
        "cases_scored": len(ok),
        "cases_with_errors": len(cases) - len(ok),
    }

    arms: dict[str, Any] = {}
    for arm in ARMS:
        rows = [c["arms"][arm] for c in ok]
        absolute = [c["absolute"][arm] for c in ok if c.get("absolute", {}).get(arm)]
        arms[arm] = {
            "rubric_neutral": round(fmean(c["rubric"][arm] for c in ok), 4) if ok else None,
            "judge_absolute": {d: round(fmean(a[d] for a in absolute), 2) for d in DIMENSIONS} if absolute else None,
            "mean_llm_calls": round(fmean(r["llm_calls"] for r in rows), 2) if rows else None,
            "mean_tokens": round(fmean(r["input_tokens"] + r["output_tokens"] for r in rows)) if rows else None,
            "mean_seconds": round(fmean(r["seconds"] for r in rows), 1) if rows else None,
            "mean_cost_usd": round(fmean(r["cost_usd"] for r in rows), 5) if rows else None,
        }
    summary["arms"] = arms

    comps: dict[str, Any] = {}
    for x, y in COMPARISONS:
        key = f"{x}_vs_{y}"
        outcomes = [c["pairwise"][key]["outcome"] for c in ok if key in c.get("pairwise", {})]
        per_dim = {}
        for dim in DIMENSIONS:
            w = sum(o[dim] == "win" for o in outcomes)
            losses = sum(o[dim] == "loss" for o in outcomes)
            t = sum(o[dim] == "tie" for o in outcomes)
            lo, hi = wilson(w, w + losses)
            per_dim[dim] = {
                "wins": w,
                "losses": losses,
                "ties": t,
                "win_rate_decisive": round(w / (w + losses), 4) if w + losses else None,
                "wilson95": [lo, hi],
                "sign_test_p": sign_test(w, losses),
            }
        rubric_diff = bootstrap_mean_diff([c["rubric"][x] - c["rubric"][y] for c in ok])
        abs_pairs = [
            (c["absolute"][x], c["absolute"][y]) for c in ok if c.get("absolute", {}).get(x) and c["absolute"].get(y)
        ]
        judge_diff = bootstrap_mean_diff([float(a["overall"] - b["overall"]) for a, b in abs_pairs])
        o = per_dim["overall"]
        comps[key] = {
            "pairwise": per_dim,
            "rubric_neutral_diff": rubric_diff,
            "judge_overall_diff": judge_diff,
            "significant_win": bool(
                o["wilson95"][0] is not None
                and o["wilson95"][0] > 0.5
                and o["sign_test_p"] is not None
                and o["sign_test_p"] < 0.05
            ),
            "significant_loss": bool(
                o["wilson95"][1] is not None
                and o["wilson95"][1] < 0.5
                and o["sign_test_p"] is not None
                and o["sign_test_p"] < 0.05
            ),
        }
    summary["comparisons"] = comps

    g_s, g_r = comps["graph_vs_single"], comps["graph_vs_refine"]
    o = g_s["pairwise"]["overall"]
    judged = o["wins"] + o["losses"] + o["ties"]
    if judged == 0:
        verdict = "No judged comparisons (dry run, or every judge call failed): no conclusion can be drawn."
    elif g_s["significant_win"] and g_r["significant_win"]:
        verdict = "Debate wins: the graph beats both one strong prompt and the compute-matched self-refine control."
    elif g_s["significant_win"]:
        verdict = "Graph beats a single prompt, but not the compute-matched self-refine control: the gain is not attributable to debate."
    elif g_s["significant_loss"]:
        verdict = "A single strong prompt beats the debate graph."
    else:
        verdict = "No statistically significant difference between the debate graph and a single strong prompt."
    summary["verdict"] = verdict
    return summary


# ----------------------------------------------------------------------------------- runner


def select_cases(limit: int, seed: int) -> list[dict[str, Any]]:
    """Round-robin across domains (stratified), deterministic for a given seed."""
    rows = [json.loads(line) for line in (ROOT / "golden_missions.jsonl").read_text().splitlines() if line.strip()]
    rng = random.Random(seed)
    by_domain: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        by_domain.setdefault(r["domain"], []).append(r)
    for v in by_domain.values():
        rng.shuffle(v)
    domains = sorted(by_domain)
    rng.shuffle(domains)
    ordered: list[dict[str, Any]] = []
    while any(by_domain.values()):
        for d in domains:
            if by_domain[d]:
                ordered.append(by_domain[d].pop())
    return ordered[: limit or None]


async def run_case(
    case: dict[str, Any], gen: LLMGateway, judge: LLMGateway | None, settings: Settings
) -> dict[str, Any]:
    arms = {arm: await generate(gen, case, arm, settings) for arm in ARMS}  # sequential: fair timing on one machine
    record: dict[str, Any] = {
        "id": case["id"],
        "domain": case["domain"],
        "mode": case["mode"],
        "mission": case["mission"],
        "arms": arms,
    }
    directives = {a: arms[a]["directive"] for a in ARMS}
    record["rubric"] = {
        a: neutral_total(
            score_directive(Directive.model_validate(d) if d else None, case["mission"], case.get("refinement"))
        )
        for a, d in directives.items()
    }
    if judge and all(directives.values()):
        record["pairwise"] = {}
        for x, y in COMPARISONS:
            try:
                record["pairwise"][f"{x}_vs_{y}"] = await judge_pair(judge, case, directives[x], directives[y])  # type: ignore[arg-type]
            except Exception as exc:  # noqa: BLE001
                record.setdefault("judge_errors", []).append(f"{x}_vs_{y}: {type(exc).__name__}")
        record["absolute"] = {}
        for a in ARMS:
            try:
                record["absolute"][a] = await judge_absolute(judge, case, directives[a])  # type: ignore[arg-type]
            except Exception as exc:  # noqa: BLE001
                record.setdefault("judge_errors", []).append(f"absolute {a}: {type(exc).__name__}")
    print(
        f"[ablation] {case['id']} done: "
        + ", ".join(f"{a}={'ok' if arms[a]['directive'] else 'ERR'} ({arms[a]['seconds']}s)" for a in ARMS),
        flush=True,
    )
    return record


def _gateways(settings: Settings, judge_model: str | None, dry_run: bool) -> tuple[LLMGateway, LLMGateway | None]:
    if dry_run:
        return LLMGateway([], allow_simulator=True), None
    gen_providers = build_providers(settings)
    if not gen_providers:
        sys.exit(
            "No live provider configured. Set LLM_PROVIDERS and a key, or LLM_PROVIDERS=ollama OLLAMA_MODEL=… (use --dry-run for plumbing only)."
        )
    judge_settings = settings.model_copy(update={"ollama_model": judge_model}) if judge_model else settings
    # Never fall back to the simulator: a simulated arm would corrupt the comparison.
    return LLMGateway(gen_providers, allow_simulator=False), LLMGateway(
        build_providers(judge_settings), allow_simulator=False
    )


def metadata(
    settings: Settings, gen: LLMGateway, judge: LLMGateway | None, judge_model: str | None, dry_run: bool
) -> dict[str, Any]:
    return {
        "created_at": datetime.now(UTC).isoformat(),
        "dry_run": dry_run,
        "generator": [f"{p.name}:{p.model}" for p in gen.providers] or ["simulator"],
        "judge": [f"{p.name}:{p.model}" for p in judge.providers] if judge else None,
        "judge_model_override": judge_model,
        "debate_max_rounds": settings.debate_max_rounds,
        "web_search": bool(settings.tavily_api_key),
        "prompt_versions": {**all_prompt_versions(), **{p.stem: _prompt(p.stem)[0] for p in PROMPTS.glob("*.md")}},
        "python": platform.python_version(),
    }


def write_results(payload: dict[str, Any], results_dir: Path) -> Path:
    if payload["meta"]["dry_run"]:
        sys.exit("Refusing to write dry-run output to the results directory.")
    results_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M")
    gen = payload["meta"]["generator"][0].replace(":", "_").replace("/", "_")
    path = results_dir / f"ablation-{stamp}-{gen}.json"
    path.write_text(json.dumps(payload, indent=2) + "\n")
    (results_dir / "ablation-latest.md").write_text(render_markdown(payload) + "\n")
    return path


def render_markdown(payload: dict[str, Any]) -> str:
    m, s = payload["meta"], payload["summary"]
    lines = [
        "# Ablation: debate graph vs single prompt",
        "",
        f"- Generated: {m['created_at']}  ",
        f"- Generator: `{', '.join(m['generator'])}` · Judge: `{', '.join(m['judge'] or ['none'])}`  ",
        f"- Cases scored: {s['cases_scored']} / {s['cases_total']} (errors: {s['cases_with_errors']}) · debate rounds ≤ {m['debate_max_rounds']} · web search: {m['web_search']}",
        "",
        f"**Verdict:** {s['verdict']}",
        "",
        "## Pairwise (blind, both orders; overall)",
        "",
        "| Comparison | Wins | Losses | Ties | Win rate (decisive) | Wilson 95% | Sign test p | Significant |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for key, c in s["comparisons"].items():
        o = c["pairwise"]["overall"]
        sig = "win" if c["significant_win"] else "loss" if c["significant_loss"] else "no"
        lines.append(
            f"| {key.replace('_', ' ')} | {o['wins']} | {o['losses']} | {o['ties']} | {o['win_rate_decisive']} | {o['wilson95']} | {o['sign_test_p']} | {sig} |"
        )
    lines += [
        "",
        "## Per-arm scores and cost",
        "",
        "| Arm | Rubric (neutral) | Judge overall (1-10) | LLM calls | Tokens | Seconds | Cost USD |",
        "|---|---|---|---|---|---|---|",
    ]
    for arm, a in s["arms"].items():
        j = a["judge_absolute"]["overall"] if a["judge_absolute"] else "–"
        lines.append(
            f"| {arm} | {a['rubric_neutral']} | {j} | {a['mean_llm_calls']} | {a['mean_tokens']} | {a['mean_seconds']} | {a['mean_cost_usd']} |"
        )
    lines += [
        "",
        "## Score differences (paired bootstrap 95% CI)",
        "",
        "| Comparison | Rubric diff | Judge overall diff |",
        "|---|---|---|",
    ]
    for key, c in s["comparisons"].items():
        r, j = c["rubric_neutral_diff"], c["judge_overall_diff"]
        lines.append(
            f"| {key.replace('_', ' ')} | {r['mean']} [{r['ci_low']}, {r['ci_high']}] | {j['mean']} [{j['ci_low']}, {j['ci_high']}] |"
        )
    lines += [
        "",
        "Method: see `evals/ablation.py` docstring. Raw per-case outputs and judge rationales are in the JSON file next to this report.",
    ]
    return "\n".join(lines)


async def _run(args: argparse.Namespace) -> dict[str, Any]:
    settings = get_settings()
    gen, judge = _gateways(settings, args.judge_model, args.dry_run)
    cases = select_cases(args.limit, args.seed)
    if args.shard:
        i, n = (int(x) for x in args.shard.split("/"))
        cases = [c for k, c in enumerate(cases) if k % n == i]
    sem = asyncio.Semaphore(args.concurrency)

    async def guarded(c: dict[str, Any]) -> dict[str, Any]:
        async with sem:
            return await run_case(c, gen, judge, settings)

    records = await asyncio.gather(*(guarded(c) for c in cases))
    return {"meta": metadata(settings, gen, judge, args.judge_model, args.dry_run), "cases": list(records)}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=12)
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--shard", help="i/n: run every n-th case starting at i (for parallel CI jobs)")
    ap.add_argument("--concurrency", type=int, default=1)
    ap.add_argument("--judge-model", help="Ollama model for the judge (default: same provider chain as generation)")
    ap.add_argument("--dry-run", action="store_true", help="simulator generation, no judge; validates plumbing only")
    ap.add_argument("--out", default=str(ROOT / "reports" / "ablation.json"))
    ap.add_argument("--merge", nargs="+", help="merge shard outputs instead of running")
    ap.add_argument("--results-dir", help="write the merged, summarised result here (e.g. evals/results)")
    args = ap.parse_args()

    if args.merge:
        parts = [json.loads(Path(p).read_text()) for p in args.merge]
        payload = {
            "meta": parts[0]["meta"],
            "cases": sorted((c for p in parts for c in p["cases"]), key=lambda c: c["id"]),
        }
        payload["meta"]["shards"] = len(parts)
    else:
        payload = asyncio.run(_run(args))

    payload["summary"] = summarise(payload["cases"])
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2) + "\n")
    print(render_markdown(payload))
    if args.results_dir:
        print(f"\nresults written to {write_results(payload, Path(args.results_dir))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
