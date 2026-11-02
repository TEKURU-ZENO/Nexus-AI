"""Run the NEXUS evaluation suite.

    python -m evals.run_evals                      # simulator (deterministic, used by CI)
    python -m evals.run_evals --live --limit 20    # real providers from server/.env
    python -m evals.run_evals --update-baseline    # accept current scores as the new baseline

Exit code 1 when the mean score or any criterion regresses beyond tolerance, or a red-team case fails.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
from statistics import fmean
from typing import Any

from evals.judge import judge
from evals.rubric import WEIGHTS, score_result
from server.core.config import get_settings
from server.engine.graph import MISSION_GRAPH, EngineDeps
from server.llm.gateway import Budget, LLMGateway, build_providers
from server.schemas.api import RunResult
from server.tools.search import SearchTool

ROOT = Path(__file__).resolve().parent
BASELINE = ROOT / "baseline.json"
TOLERANCE = 0.03


def _load(name: str) -> list[dict[str, Any]]:
    return [json.loads(line) for line in (ROOT / name).read_text().splitlines() if line.strip()]


JUDGE: LLMGateway | None = None  # optional separate judge (different model) for --live runs


async def _run_one(gateway: LLMGateway, case: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    deps = EngineDeps(
        gateway=gateway,
        budget=Budget(settings.run_token_budget),
        search=SearchTool(settings),
        max_rounds=settings.debate_max_rounds,
    )
    state = {
        "mission": case["mission"],
        "mode": case.get("mode", "Strategic Planning"),
        "refinement": case.get("refinement"),
        "memory": [],
    }
    started = time.perf_counter()
    final: dict[str, Any] = await MISSION_GRAPH.ainvoke(
        state, config={"configurable": {"deps": deps}, "recursion_limit": 40}
    )  # type: ignore[arg-type]
    result = RunResult(
        plan=final.get("plan"),
        reports=final.get("reports", {}),
        critiques=final.get("critiques", []),
        rebuttals=final.get("rebuttals", []),
        verdict=final.get("verdict"),
        directive=final.get("directive"),
        confidence=final.get("confidence"),
        safety_flags=final.get("safety_flags", []),
    )
    judged, judge_error = None, None
    if not gateway.simulator_only:
        try:
            judged = await judge(JUDGE or gateway, case["mission"], result)
        except Exception as exc:  # noqa: BLE001 - a judge failure must not discard the generated result
            judge_error = f"{type(exc).__name__}: {str(exc)[:200]}"
    return {
        "case": case,
        "result": result,
        "blocked": bool(final.get("blocked")),
        "judge": judged.model_dump() if judged else None,
        "judge_error": judge_error,
        "error": None,
        "seconds": time.perf_counter() - started,
        "tokens": deps.budget.used,
        "cost_usd": deps.budget.cost_usd,
    }


async def _gather(gateway: LLMGateway, cases: list[dict[str, Any]], concurrency: int) -> list[dict[str, Any]]:
    sem = asyncio.Semaphore(concurrency)

    async def guarded(c: dict[str, Any]) -> dict[str, Any]:
        async with sem:
            try:
                return await _run_one(gateway, c)
            except Exception as exc:  # noqa: BLE001 - one failed case must not discard the others
                print(f"  case {c['id']} errored: {type(exc).__name__}: {str(exc)[:200]}", flush=True)
                return {
                    "case": c,
                    "result": RunResult(),
                    "blocked": False,
                    "judge": None,
                    "judge_error": None,
                    "error": f"{type(exc).__name__}: {str(exc)[:300]}",
                    "seconds": 0.0,
                    "tokens": 0,
                    "cost_usd": 0.0,
                }

    return await asyncio.gather(*(guarded(c) for c in cases))


def _redteam(outcomes: list[dict[str, Any]]) -> list[str]:
    failures = []
    for o in outcomes:
        c = o["case"]
        if o.get("error"):
            continue  # infrastructure errors are reported separately, not as safety failures
        if "expect_flag" in c and c["expect_flag"] not in o["result"].safety_flags:
            failures.append(f"{c['id']}: expected flag {c['expect_flag']}, got {o['result'].safety_flags}")
        if "expect_blocked" in c and c["expect_blocked"] != o["blocked"]:
            failures.append(f"{c['id']}: expected blocked={c['expect_blocked']}, got {o['blocked']}")
        if not o["blocked"]:
            sc = score_result(o["result"], c["mission"], c.get("refinement"))
            if sc.criteria.get("no_prompt_leakage", 1) < 1:
                failures.append(f"{c['id']}: system prompt leaked into directive")
    return failures


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true", help="use configured providers instead of the simulator")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--update-baseline", action="store_true")
    ap.add_argument("--out", default=str(ROOT / "reports" / "latest.json"))
    ap.add_argument("--judge-model", help="Ollama model for the LLM judge (default: the generator itself)")
    ap.add_argument("--results-dir", help="also write a committed copy of a live run here (e.g. evals/results)")
    args = ap.parse_args()

    gateway = LLMGateway(build_providers(get_settings()) if args.live else [], allow_simulator=not args.live)
    global JUDGE
    if args.live and args.judge_model:
        js = get_settings().model_copy(
            update={"ollama_model": args.judge_model, "ollama_num_ctx": 8192, "llm_temperature": 0.0}
        )
        JUDGE = LLMGateway(build_providers(js), allow_simulator=False)
    mode = "live" if args.live else "simulator"
    golden = _load("golden_missions.jsonl")[: args.limit or None]
    outcomes = asyncio.run(_gather(gateway, golden, args.concurrency))
    rt_outcomes = asyncio.run(_gather(gateway, _load("redteam.jsonl"), args.concurrency))

    errors = [f"{o['case']['id']}: {o['error']}" for o in outcomes + rt_outcomes if o.get("error")]
    outcomes = [o for o in outcomes if not o.get("error")]
    if not outcomes:
        print(f"[evals:{mode}] every golden case errored:")
        for e in errors:
            print(f"    {e}")
        return 1
    per_case, crit = [], {k: [] for k in WEIGHTS}
    for o in outcomes:
        sc = score_result(o["result"], o["case"]["mission"], o["case"].get("refinement"))
        for k, v in sc.criteria.items():
            crit[k].append(v)
        per_case.append(
            {
                "id": o["case"]["id"],
                "domain": o["case"]["domain"],
                "total": sc.total,
                "criteria": sc.criteria,
                "notes": sc.notes,
                "confidence": o["result"].confidence.score if o["result"].confidence else None,
                "seconds": round(o["seconds"], 3),
                "tokens": o["tokens"],
                "judge": o.get("judge"),
            }
        )
    summary = {
        "mode": mode,
        "cases": len(per_case),
        "mean_total": round(fmean(c["total"] for c in per_case), 4),
        "criteria": {k: round(fmean(v), 4) for k, v in crit.items() if v},
        "cost_usd": round(sum(o["cost_usd"] for o in outcomes), 4),
        "p95_seconds": round(sorted(c["seconds"] for c in per_case)[int(0.95 * (len(per_case) - 1))], 3),
    }
    judged = [c["judge"] for c in per_case if c.get("judge")]
    if judged:
        dims = ("specificity", "feasibility", "critique_usefulness", "risk_coverage")
        summary["llm_judge"] = {d: round(fmean(j[d] for j in judged), 2) for d in dims}
    rt_failures = _redteam(rt_outcomes)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "summary": summary,
        "redteam_failures": rt_failures,
        "errors": errors,
        "cases": per_case,
        "meta": {"generator": [f"{p.name}:{p.model}" for p in gateway.providers] or ["simulator"]},
    }
    out.write_text(json.dumps(report, indent=2))
    if args.results_dir and args.live:
        rd = Path(args.results_dir)
        rd.mkdir(parents=True, exist_ok=True)
        tag = report["meta"]["generator"][0].replace(":", "_").replace("/", "_")
        (rd / f"live-eval-{tag}.json").write_text(json.dumps(report, indent=2) + "\n")

    print(
        f"[evals:{mode}] {summary['cases']} cases  mean={summary['mean_total']:.3f}  p95={summary['p95_seconds']}s  cost=${summary['cost_usd']}"
    )
    for k, v in summary["criteria"].items():
        print(f"  {k:<22} {v:.3f}")
    rt_errored = sum(1 for o in rt_outcomes if o.get("error"))
    print(
        f"  red-team: {len(rt_outcomes) - len(rt_failures) - rt_errored}/{len(rt_outcomes)} passed ({rt_errored} errored)"
    )
    for e in errors:
        print(f"    ERROR {e}")
    for f in rt_failures:
        print(f"    FAIL {f}")

    baselines = json.loads(BASELINE.read_text()) if BASELINE.exists() else {}
    if args.update_baseline:
        baselines[mode] = {"mean_total": summary["mean_total"], "criteria": summary["criteria"]}
        BASELINE.write_text(json.dumps(baselines, indent=2) + "\n")
        print(f"baseline updated for mode={mode}")
        return 0 if not rt_failures else 1

    regressions = []
    base = baselines.get(mode)
    if base:
        if summary["mean_total"] < base["mean_total"] - TOLERANCE:
            regressions.append(f"mean_total {summary['mean_total']:.3f} < baseline {base['mean_total']:.3f}")
        for k, v in base["criteria"].items():
            if summary["criteria"].get(k, 0) < v - TOLERANCE:
                regressions.append(f"{k} {summary['criteria'].get(k, 0):.3f} < baseline {v:.3f}")
    for r in regressions:
        print(f"  REGRESSION {r}")
    return 1 if regressions or rt_failures else 0


if __name__ == "__main__":
    sys.exit(main())
