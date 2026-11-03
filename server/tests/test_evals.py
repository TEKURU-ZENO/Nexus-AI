from __future__ import annotations

from evals.rubric import score_result
from server.llm.simulator import simulate
from server.schemas.agents import AgentReport, Critique, Directive, JudgeVerdict, MissionPlan, Rebuttal
from server.schemas.api import RunResult


def _result(mission: str, **kw: object) -> RunResult:
    ctx = {"mission": mission, "mode": "Strategic Planning", **kw}
    critique = simulate(Critique, ctx)
    return RunResult(
        plan=simulate(MissionPlan, ctx),
        reports={a: simulate(AgentReport, {**ctx, "agent_id": a}) for a in ("researcher", "architect", "strategist")},
        critiques=[critique],
        rebuttals=[simulate(Rebuttal, {**ctx, "critique": critique})],
        verdict=simulate(JudgeVerdict, ctx),
        directive=simulate(Directive, ctx),
    )


def test_rubric_rewards_on_topic_output() -> None:
    mission = "Open a bakery in Lisbon that sells gluten-free bread"
    assert score_result(_result(mission), mission).total > 0.9


def test_rubric_penalises_off_topic_directive() -> None:
    """The original bug: a bakery mission answered with hospital content must score badly."""
    mission = "Open a bakery in Lisbon that sells gluten-free bread"
    wrong = _result("Design an AI platform for reducing hospital misdiagnosis")
    score = score_result(wrong, mission)
    assert score.criteria["specificity"] < 0.3
    assert score.notes


def test_rubric_checks_refinement_adherence() -> None:
    mission = "Open a bakery in Lisbon"
    ignored = score_result(_result(mission), mission, refinement="Keep capital expenditure under twenty thousand euros")
    honoured = score_result(
        _result(mission, refinement="Keep capital expenditure under twenty thousand euros"),
        mission,
        refinement="Keep capital expenditure under twenty thousand euros",
    )
    assert honoured.criteria["constraint_adherence"] > ignored.criteria["constraint_adherence"]


def test_rubric_detects_prompt_leakage() -> None:
    from server.engine.safety import DATA_HANDLING_RULES

    mission = "Open a bakery in Lisbon"
    leaked = _result(mission)
    assert leaked.directive is not None
    leaked.directive.rationale = DATA_HANDLING_RULES
    assert score_result(leaked, mission).criteria["no_prompt_leakage"] == 0.0


def test_run_evals_survives_a_failing_case(monkeypatch, capsys) -> None:  # type: ignore[no-untyped-def]
    """Regression: one provider error in the red-team phase crashed a 2-hour live run and lost every result."""
    import asyncio

    from evals import run_evals

    real = run_evals._run_one

    async def flaky(gateway, case):  # type: ignore[no-untyped-def]
        if case["id"] in {"g002", "rt003"}:
            raise RuntimeError("ollama runner crashed")
        return await real(gateway, case)

    monkeypatch.setattr(run_evals, "_run_one", flaky)
    from server.llm.gateway import LLMGateway

    outcomes = asyncio.run(run_evals._gather(LLMGateway([]), run_evals._load("golden_missions.jsonl")[:3], 2))
    assert [bool(o["error"]) for o in outcomes] == [False, True, False]
    assert "g002 errored" in capsys.readouterr().out


def test_partial_results_are_written_per_case(tmp_path, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    import asyncio
    import json

    from evals import run_evals
    from server.llm.gateway import LLMGateway

    monkeypatch.setattr(run_evals, "PARTIAL", tmp_path / "p.jsonl")
    asyncio.run(run_evals._gather(LLMGateway([]), run_evals._load("golden_missions.jsonl")[:2], 1))
    rows = [json.loads(line) for line in (tmp_path / "p.jsonl").read_text().splitlines()]
    assert [r["id"] for r in rows] == ["g001", "g002"]
    assert rows[0]["result"]["directive"]
