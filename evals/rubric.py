"""Deterministic rubric for mission outputs (0-1 per criterion).

These checks are cheap, reproducible, and run in CI on every change. They catch structural and
behavioural regressions (missing sections, ignored constraints, unanswered critiques, ungrounded
over-confidence, prompt leakage). Content *quality* is additionally scored by the optional
LLM-as-judge (`judge.py`) when a provider key is configured.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from server.engine.confidence import GROUNDED_KINDS
from server.engine.safety import DATA_HANDLING_RULES
from server.prompts import all_prompt_versions, load_prompt
from server.schemas.api import RunResult

_STOP = {
    "with",
    "that",
    "this",
    "from",
    "into",
    "for",
    "and",
    "the",
    "our",
    "their",
    "design",
    "build",
    "create",
    "plan",
    "launch",
    "validate",
    "assess",
    "analyse",
    "roadmap",
    "architect",
    "using",
    "across",
    "without",
}
_VERB = re.compile(r"^(?:[A-Z][a-z]+)\b")

WEIGHTS = {
    "completeness": 0.2,
    "specificity": 0.2,
    "debate_integrity": 0.15,
    "actionability": 0.15,
    "constraint_adherence": 0.1,
    "calibration_sanity": 0.1,
    "no_prompt_leakage": 0.1,
}


@dataclass
class Score:
    criteria: dict[str, float] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    @property
    def total(self) -> float:
        return round(sum(WEIGHTS[k] * v for k, v in self.criteria.items()), 4)


def _keywords(text: str) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z-]{4,}", text.lower())
    return list(dict.fromkeys(w for w in words if w not in _STOP))[:6]


def _directive_text(result: RunResult) -> str:
    d = result.directive
    if not d:
        return ""
    parts = [d.title, d.decision, d.rationale, *d.tradeoffs, *d.next_actions]
    for ph in d.phases:
        parts += [ph.name, ph.goal, *ph.actions, ph.exit_criteria]
    parts += [f"{k.name} {k.target}" for k in d.kpis] + [f"{r.risk} {r.mitigation}" for r in d.risks]
    return " ".join(parts)


def score_result(result: RunResult, mission: str, refinement: str | None = None) -> Score:
    s = Score()
    d = result.directive
    if d is None:
        s.criteria = dict.fromkeys(WEIGHTS, 0.0)
        s.notes.append("no directive")
        return s

    checks = [
        len(d.phases) >= 2,
        len(d.kpis) >= 2,
        len(d.risks) >= 2,
        all(r.owner.strip() for r in d.risks),
        len(d.tradeoffs) >= 2,
        len(d.next_actions) >= 3,
        all(p.exit_criteria.strip() for p in d.phases),
        len(result.reports) >= 3,
    ]
    s.criteria["completeness"] = sum(checks) / len(checks)

    text = _directive_text(result).lower()
    kws = _keywords(mission)
    hits = [k for k in kws if k[:6] in text]
    s.criteria["specificity"] = len(hits) / len(kws) if kws else 1.0
    if s.criteria["specificity"] < 0.5:
        s.notes.append(f"directive ignores mission terms: {sorted(set(kws) - set(hits))}")

    if result.critiques and result.rebuttals:
        answered = {r.challenge_index for r in result.rebuttals[-1].responses}
        s.criteria["debate_integrity"] = min(1.0, len(answered) / max(1, len(result.critiques[-1].challenges)))
        if result.verdict is None:
            s.criteria["debate_integrity"] *= 0.5
    else:
        s.criteria["debate_integrity"] = 0.0

    actionable = [a for a in d.next_actions if _VERB.match(a.strip()) and len(a.split()) >= 3]
    s.criteria["actionability"] = len(actionable) / len(d.next_actions)

    if refinement:
        rk = _keywords(refinement) or [refinement.lower()[:8]]
        s.criteria["constraint_adherence"] = sum(1 for k in rk if k[:6] in text) / len(rk)
    else:
        s.criteria["constraint_adherence"] = 1.0

    findings = [f for r in result.reports.values() for f in r.findings]
    overconfident = [
        f for f in findings if f.confidence > 0.85 and not any(e.kind in GROUNDED_KINDS for e in f.evidence)
    ]
    s.criteria["calibration_sanity"] = 1 - (len(overconfident) / len(findings) if findings else 0)

    leak_markers = [DATA_HANDLING_RULES[:60].lower()] + [
        load_prompt(p).text[:60].lower() for p in all_prompt_versions()
    ]
    s.criteria["no_prompt_leakage"] = 0.0 if any(m in text for m in leak_markers) else 1.0
    return s
