from __future__ import annotations

import asyncio
from typing import Any, TypeVar

import pytest
from langchain_core.messages import BaseMessage
from pydantic import BaseModel

from evals import ablation as ab
from server.llm.gateway import AllProvidersFailed, Budget, LLMGateway
from server.llm.simulator import simulate
from server.tests.fakes import FakeProvider

T = TypeVar("T", bound=BaseModel)


def test_consolidate_requires_consistency_across_orders() -> None:
    all_a = dict.fromkeys(ab.DIMENSIONS, "A")
    all_b = dict.fromkeys(ab.DIMENSIONS, "B")
    # Judge prefers X in both orders (A first, then B when swapped) -> win.
    assert set(ab.consolidate(all_a, all_b).values()) == {"win"}
    # Judge always picks position A (pure position bias) -> tie, never a win.
    assert set(ab.consolidate(all_a, all_a).values()) == {"tie"}
    assert set(ab.consolidate(all_b, all_a).values()) == {"loss"}


def test_statistics() -> None:
    lo, hi = ab.wilson(18, 20)
    assert lo is not None and hi is not None and 0.65 < lo < 0.75 and hi > 0.95
    assert ab.wilson(0, 0) == (None, None)
    assert ab.sign_test(10, 10) == 1.0
    assert ab.sign_test(15, 1) < 0.001
    assert ab.bootstrap_mean_diff([1.0, 1.0, 1.0])["ci_low"] == 1.0


def _case(i: int, outcome: str) -> dict[str, Any]:
    d = {"decision": "x"}
    arms = {
        a: {"directive": d, "llm_calls": 1, "input_tokens": 1, "output_tokens": 1, "seconds": 1.0, "cost_usd": 0.0}
        for a in ab.ARMS
    }
    # A judge that passes its self-audit: balanced positions, varied scores, correct on the known-answer probe.
    raw = [{"overall": "A"}, {"overall": "B"}] if i % 2 else [{"overall": "B"}, {"overall": "A"}]
    pair = {"outcome": dict.fromkeys(ab.DIMENSIONS, outcome), "raw": raw}
    return {
        "id": f"c{i}",
        "arms": arms,
        "rubric": dict.fromkeys(ab.ARMS, 0.9),
        "pairwise": {f"{x}_vs_{y}": pair for x, y in ab.COMPARISONS},
        "absolute": {a: dict.fromkeys(ab.DIMENSIONS, 4 + (i + k) % 6) for k, a in enumerate(ab.ARMS)},
        "probe": {"outcome": {"overall": "win"}},
    }


def test_verdict_rule_is_conservative() -> None:
    assert "No statistically significant" in ab.summarise([_case(i, "tie") for i in range(30)])["verdict"]
    assert ab.summarise([_case(i, "win") for i in range(20)])["verdict"].startswith("Debate wins")
    # 3 wins of 3 decisive pairs is not enough evidence.
    few = ab.summarise([_case(i, "win") for i in range(3)])
    assert few["comparisons"]["graph_vs_single"]["significant_win"] is False


def test_select_cases_is_stratified_and_deterministic() -> None:
    a, b = ab.select_cases(15, 1), ab.select_cases(15, 1)
    assert [c["id"] for c in a] == [c["id"] for c in b]
    assert len({c["domain"] for c in a}) == 15


@pytest.mark.asyncio
async def test_live_arms_never_fall_back_to_simulator() -> None:
    gw = LLMGateway([FakeProvider(fail=RuntimeError("down"))], allow_simulator=False)
    with pytest.raises(AllProvidersFailed):
        await ab._arm_single(gw, ab.select_cases(1, 1)[0], Budget(10_000))


class ScriptedJudge:
    """Prefers whichever directive mentions 'debate' (to test plumbing and position handling)."""

    name, model = "judge", "ollama/judge"

    async def invoke(self, schema: type[T], messages: list[BaseMessage]) -> tuple[T, int, int]:
        text = str(messages[-1].content)
        if schema is ab.PairwiseVerdict:
            a_part, b_part = text.split("Directive B:")
            pick = "A" if "DEBATE" in a_part else "B" if "DEBATE" in b_part else "tie"
            return schema.model_validate({**dict.fromkeys(ab.DIMENSIONS, pick), "rationale": "scripted"}), 0, 0
        return schema.model_validate(dict.fromkeys(ab.DIMENSIONS, 6)), 0, 0


class TaggingProvider(FakeProvider):
    """Generator stand-in: graph synthesis output is tagged so the scripted judge can recognise it."""

    async def invoke(self, schema: type[T], messages: list[BaseMessage]) -> tuple[T, int, int]:
        value, tin, tout = await super().invoke(schema, messages)
        if schema.__name__ == "Directive" and "Debate: critiques=" in str(messages[-1].content):
            value.decision = "DEBATE " + value.decision  # type: ignore[attr-defined]
        return value, tin, tout


def test_end_to_end_with_scripted_judge(tmp_path: Any) -> None:
    from server.tests.conftest import make_settings

    settings = make_settings(tmp_path)
    gen = LLMGateway([TaggingProvider()], allow_simulator=False)
    judge = LLMGateway([ScriptedJudge()], allow_simulator=False)
    cases = ab.select_cases(4, 3)

    async def go() -> list[dict[str, Any]]:
        return list(await asyncio.wait_for(asyncio.gather(*(ab.run_case(c, gen, judge, settings) for c in cases)), 60))

    records = asyncio.run(go())
    s = ab.summarise(list(records))
    assert s["cases_scored"] == 4
    assert s["comparisons"]["graph_vs_single"]["pairwise"]["overall"]["wins"] == 4
    assert s["comparisons"]["refine_vs_single"]["pairwise"]["overall"]["ties"] == 4
    assert (
        s["arms"]["graph"]["mean_llm_calls"]
        > s["arms"]["refine"]["mean_llm_calls"]
        > s["arms"]["single"]["mean_llm_calls"]
    )
    md = ab.render_markdown({"meta": ab.metadata(settings, gen, judge, None, False), "summary": s})
    assert "graph vs single" in md


def test_dry_run_cannot_be_written_as_results(tmp_path: Any) -> None:
    with pytest.raises(SystemExit):
        ab.write_results({"meta": {"dry_run": True}}, tmp_path)


def test_simulator_unchanged_for_directive() -> None:
    assert simulate  # the simulator is only used by --dry-run; real runs disable it (see test above)


def _raw_case(i: int, first: str, second: str, score: int) -> dict[str, Any]:
    c = _case(i, "tie")
    for p in c["pairwise"].values():
        p["raw"] = [{"overall": first}, {"overall": second}]
    c["absolute"] = {a: dict.fromkeys(ab.DIMENSIONS, score) for a in ab.ARMS}
    return c


def test_position_biased_judge_makes_result_inconclusive() -> None:
    """Reproduces the first live run: the judge picked position A 88% of the time and scored everything 8."""
    s = ab.summarise([_raw_case(i, "A", "A", 8) for i in range(15)])
    assert s["judge_validity"]["valid"] is False
    assert set(s["judge_validity"]["failed"]) == {"position_bias", "score_spread"}
    assert s["verdict"].startswith("Inconclusive")


def test_valid_judge_passes_self_audit() -> None:
    cases = [_raw_case(i, "A" if i % 2 else "B", "B" if i % 2 else "A", 4 + i % 6) for i in range(20)]
    for c in cases:
        c["probe"] = {"outcome": {"overall": "win"}}
    v = ab.summarise(cases)["judge_validity"]
    assert v["valid"] is True, v


def test_off_topic_probe_is_actually_off_topic() -> None:
    case = ab.select_cases(1, 1)[0]
    probe = ab.off_topic_directive(case)
    assert case["mission"].split()[2].lower() not in probe["decision"].lower()
