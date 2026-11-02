"""Deterministic, mission-aware offline provider.

Used for demos without API keys, CI, and as the last-resort fallback. It never pretends to be a
model: every run that touches it is flagged `simulated`, its confidence is capped, and its output is
never committed to memory. Output is derived from the mission text so different missions produce
different (template-grade) plans.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any, TypeVar, cast

from pydantic import BaseModel

from server.schemas.agents import (
    KPI,
    AgentReport,
    Challenge,
    Critique,
    Directive,
    Evidence,
    Finding,
    JudgeVerdict,
    MissionPlan,
    OwnedRisk,
    Phase,
    Rebuttal,
    RebuttalItem,
    Risk,
    Workstream,
)

T = TypeVar("T", bound=BaseModel)

_LEADING = re.compile(
    r"^(please\s+)?(design|build|create|launch|open|start|develop|make|plan|define|write|draft|propose)\s+"
    r"(an?|the|our|my)?\s*",
    re.IGNORECASE,
)
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
    "your",
    "their",
    "about",
    "using",
    "reduce",
    "reducing",
    "build",
    "design",
    "create",
    "launch",
    "strategy",
    "platform",
    "model",
    "open",
    "start",
    "develop",
    "make",
    "plan",
    "define",
    "write",
    "draft",
    "propose",
    "sells",
    "please",
}


@dataclass(frozen=True)
class Domain:
    name: str
    buyer: str
    user: str
    regulator: str
    metric: str
    channel: str


DOMAINS: list[tuple[tuple[str, ...], Domain]] = [
    (
        ("health", "hospital", "clinic", "medical", "diagnos", "patient"),
        Domain(
            "healthcare",
            "clinic operations leaders",
            "clinicians",
            "health-data and medical-device rules (e.g. HIPAA, MDR)",
            "missed or delayed diagnoses per 1,000 cases",
            "specialty clinic networks",
        ),
    ),
    (
        ("ransomware", "cyber", "security", "breach", "attack", "soc"),
        Domain(
            "cybersecurity",
            "the CISO",
            "incident responders",
            "breach-notification obligations",
            "mean time to contain",
            "MSSP partnerships",
        ),
    ),
    (
        ("school", "education", "student", "teacher", "learn", "tutor"),
        Domain(
            "education",
            "district administrators",
            "teachers and students",
            "student-data privacy rules",
            "weekly active learners and learning-gain scores",
            "district pilots",
        ),
    ),
    (
        ("transport", "transit", "mobility", "city", "cities", "megacit"),
        Domain(
            "urban mobility",
            "city transit authorities",
            "commuters",
            "public procurement and safety rules",
            "on-time performance and cost per passenger-km",
            "municipal pilots",
        ),
    ),
    (
        ("bakery", "restaurant", "cafe", "food", "retail", "shop", "store"),
        Domain(
            "local retail",
            "the owner-operator",
            "local customers",
            "food-safety and licensing rules",
            "weekly repeat-customer rate and gross margin",
            "neighbourhood partnerships and social channels",
        ),
    ),
    (
        ("fintech", "bank", "payment", "lending", "finance", "insurance"),
        Domain(
            "financial services",
            "compliance-led finance teams",
            "end customers",
            "KYC/AML and consumer-credit rules",
            "approval accuracy and fraud loss rate",
            "embedded-finance partners",
        ),
    ),
]
GENERIC = Domain(
    "general",
    "the economic buyer",
    "primary users",
    "applicable sector regulation",
    "time-to-value for the first cohort",
    "design-partner pilots",
)


def _subject(mission: str) -> str:
    text = mission.strip().rstrip(".!?")
    text = _LEADING.sub("", text)
    return text[:120] or "the mission"


def _keywords(mission: str, limit: int = 4) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z-]{3,}", mission.lower())
    out: list[str] = []
    for word in words:
        if word not in _STOP and word not in out:
            out.append(word)
    return out[:limit] or ["mission"]


def _domain(mission: str) -> Domain:
    lower = mission.lower()
    for needles, domain in DOMAINS:
        if any(n in lower for n in needles):
            return domain
    return GENERIC


def _seed(*parts: str) -> int:
    return int(hashlib.sha256("|".join(parts).encode()).hexdigest()[:8], 16)


def _conf(seed: int, base: float) -> float:
    return round(base + (seed % 9) / 100, 2)


def _ctx(context: dict[str, Any]) -> tuple[str, str, str | None, Domain, list[str], int]:
    mission = str(context.get("mission", "the mission"))
    mode = str(context.get("mode", "Strategic Planning"))
    refinement = context.get("refinement")
    return mission, mode, refinement, _domain(mission), _keywords(mission), _seed(mission, mode, str(refinement))


def _plan(context: dict[str, Any]) -> MissionPlan:
    mission, mode, refinement, d, kw, _ = _ctx(context)
    subject = _subject(mission)
    focus = ", ".join(kw[:3])
    extra = f" while honouring the constraint: {refinement}" if refinement else ""
    return MissionPlan(
        objective=f"{mode}: {subject} — reach a go/no-go decision backed by a measurable pilot{extra}.",
        workstreams=[
            Workstream(
                agent_id="researcher",
                priority=1,
                question=f"Which {d.user} pain around {focus} is frequent and costly enough to buy for, and what evidence proves it?",
            ),
            Workstream(
                agent_id="architect",
                priority=2,
                question=f"What is the smallest supervised system that delivers {subject} with auditability?",
            ),
            Workstream(
                agent_id="strategist",
                priority=2,
                question=f"How do we reach {d.buyer} through {d.channel} and price on outcomes?",
            ),
        ],
        key_assumptions=[
            f"{d.buyer.capitalize()} feel the problem acutely enough to pilot within one quarter.",
            f"Success can be measured with {d.metric}.",
        ],
        success_criteria=[f"Pilot shows a measurable improvement in {d.metric}.", "Two paying design partners."],
    )


def _report(context: dict[str, Any]) -> AgentReport:
    mission, _mode, refinement, d, kw, seed = _ctx(context)
    agent = str(context.get("agent_id", "researcher"))
    subject = _subject(mission)
    k = kw[0]
    note = f" Adjusted for: {refinement}." if refinement else ""
    templates: dict[str, list[Finding]] = {
        "researcher": [
            Finding(
                claim=f"The highest-value wedge in {subject} is the recurring {k} workflow that {d.user} repeat weekly.",
                rationale=f"Repetition makes {d.metric} measurable within a single pilot cycle.{note}",
                evidence=[
                    Evidence(
                        kind="model_knowledge", summary=f"Typical {d.name} adoption favours narrow, frequent workflows."
                    )
                ],
                risk=Risk.MEDIUM,
                confidence=_conf(seed, 0.55),
                recommendation=f"Interview 10 {d.user} and quantify the frequency and cost of the {k} problem.",
            ),
            Finding(
                claim=f"{d.regulator.capitalize()} will shape what can be automated.",
                rationale="Compliance determines whether a human must stay in the loop.",
                evidence=[Evidence(kind="model_knowledge", summary=f"Regulatory context for {d.name}.")],
                risk=Risk.HIGH,
                confidence=_conf(seed >> 3, 0.6),
                recommendation="Map obligations with counsel before designing automation boundaries.",
            ),
        ],
        "architect": [
            Finding(
                claim=f"A supervised workflow (intake → analysis → human review → audit log) is sufficient for a first {subject} pilot.",
                rationale=f"It earns trust from {d.user} before autonomy expands.{note}",
                evidence=[Evidence(kind="model_knowledge", summary="Human-in-the-loop systems reduce adoption risk.")],
                risk=Risk.MEDIUM,
                confidence=_conf(seed >> 5, 0.6),
                recommendation="Ship intake, review queue, decision log, and export; defer autonomous actions.",
            ),
            Finding(
                claim="Every recommendation needs provenance to be auditable.",
                rationale="Without evidence trails, reviewers cannot verify output.",
                evidence=[],
                risk=Risk.MEDIUM,
                confidence=_conf(seed >> 7, 0.55),
                recommendation="Persist inputs, model versions, and reviewer actions per decision.",
            ),
        ],
        "strategist": [
            Finding(
                claim=f"Sell to {d.buyer} via {d.channel} with outcome-linked pricing.",
                rationale=f"Buyers reward measurable movement in {d.metric}, not AI claims.{note}",
                evidence=[
                    Evidence(kind="model_knowledge", summary="Outcome pricing lowers perceived risk in early markets.")
                ],
                risk=Risk.MEDIUM,
                confidence=_conf(seed >> 9, 0.5),
                recommendation="Run 2–3 paid pilots with pre-agreed success metrics, then publish case studies.",
            ),
            Finding(
                claim="Retention depends on becoming the system of record for the workflow.",
                rationale="Switching costs grow with stored history and integrations.",
                evidence=[],
                risk=Risk.LOW,
                confidence=_conf(seed >> 11, 0.5),
                recommendation="Integrate with the tools already used and make history exportable.",
            ),
        ],
    }
    findings = templates.get(agent, templates["researcher"])
    return AgentReport(
        agent_id=agent,
        summary=f"[Simulated] {agent.capitalize()} analysis of {subject} for {d.buyer}.",
        findings=findings,
        open_questions=[f"What baseline {d.metric} do pilot sites have today?"],
    )


def _critique(context: dict[str, Any]) -> Critique:
    mission, _mode, refinement, d, _kw, _ = _ctx(context)
    subject = _subject(mission)
    challenges = [
        Challenge(
            target_agent="researcher",
            severity=Risk.HIGH,
            claim=f"{d.user.capitalize()} will adopt quickly.",
            reasoning=f"Incentives, liability and workflow change in {d.name} slow adoption regardless of product quality.",
            proof_required=f"Signed pilot commitments from at least two {d.buyer}.",
        ),
        Challenge(
            target_agent="strategist",
            severity=Risk.MEDIUM,
            claim="Outcome-linked pricing is viable.",
            reasoning=f"It requires agreed baselines for {d.metric}, which most prospects lack.",
            proof_required="Baseline measurements captured before pilot start.",
        ),
    ]
    if refinement:
        challenges.append(
            Challenge(
                target_agent="plan",
                severity=Risk.MEDIUM,
                claim=f"The plan satisfies the constraint '{refinement}'.",
                reasoning="Constraint compliance is asserted, not demonstrated.",
                proof_required="An explicit check of each phase against the constraint.",
            )
        )
    return Critique(
        most_dangerous_assumption=f"That demand for {subject} is proven before any {d.user} have committed.",
        challenges=challenges,
        overall_risk=Risk.HIGH,
    )


def _rebuttal(context: dict[str, Any]) -> Rebuttal:
    critique = context.get("critique")
    n = len(critique.challenges) if isinstance(critique, Critique) else 2
    items = [
        RebuttalItem(
            challenge_index=0,
            position="concede",
            argument="Agreed: adoption is unproven; the plan now gates scale-up on signed pilots.",
            revised_claim="Adoption will be validated through paid pilots before expansion.",
        ),
    ]
    for i in range(1, n):
        items.append(
            RebuttalItem(
                challenge_index=i,
                position="revise",
                argument="Baseline capture is added as a pilot entry criterion.",
                revised_claim="Pricing is outcome-linked only where a baseline exists.",
            )
        )
    return Rebuttal(responses=items)


def _verdict(context: dict[str, Any]) -> JudgeVerdict:
    rnd = int(context.get("round", 1))
    return JudgeVerdict(
        resolved=rnd >= 1,
        agreement=0.72,
        unresolved_issues=["Market demand is still based on model knowledge, not external evidence."],
        notes="Specialists conceded the adoption risk and added gating criteria.",
    )


def _directive(context: dict[str, Any]) -> Directive:
    mission, mode, refinement, d, kw, _ = _ctx(context)
    subject = _subject(mission)
    suffix = f" (refined for: {refinement})" if refinement else ""
    return Directive(
        title=f"{mode} Directive — {subject}"[:140],
        decision=f"Proceed with a supervised pilot of {subject} with two design partners ({d.buyer}), gated on measured {d.metric}{suffix}.",
        rationale="Specialists agree the wedge is narrow and measurable; the critic's adoption risk is mitigated by gating scale-up on pilot evidence.",
        tradeoffs=[
            "A supervised workflow slows time-to-autonomy but lowers trust and liability risk.",
            f"Focusing on one {kw[0]} workflow limits early revenue but makes results provable.",
        ],
        phases=[
            Phase(
                name="Validate",
                goal=f"Prove the {kw[0]} problem is frequent and costly.",
                actions=[f"Interview 10 {d.user}", f"Capture baseline {d.metric}"],
                exit_criteria="Two signed pilot agreements.",
            ),
            Phase(
                name="Pilot",
                goal="Deliver a supervised workflow with audit trail.",
                actions=["Ship intake, review queue and decision log", "Weekly review with pilot sponsors"],
                exit_criteria=f"Measured improvement in {d.metric} versus baseline.",
            ),
            Phase(
                name="Scale",
                goal="Convert pilots into repeatable sales.",
                actions=["Publish case studies", f"Expand via {d.channel}"],
                exit_criteria="Repeatable sales motion with positive unit economics.",
            ),
        ],
        kpis=[
            KPI(name=d.metric, target="Improve vs. baseline during pilot", measurement="Pilot telemetry, weekly"),
            KPI(name="Pilot conversion", target="≥ 50% of pilots convert to paid", measurement="CRM"),
        ],
        risks=[
            OwnedRisk(
                risk="Adoption slower than planned",
                severity=Risk.HIGH,
                owner="Head of Product",
                mitigation="Gate expansion on signed pilots and measured outcomes.",
            ),
            OwnedRisk(
                risk=f"Non-compliance with {d.regulator}",
                severity=Risk.HIGH,
                owner="Compliance Lead",
                mitigation="Legal review of automation boundaries before pilot.",
            ),
        ],
        next_actions=[f"Schedule 10 {d.user} interviews", f"Define baseline for {d.metric}", "Draft pilot agreement"],
    )


_BUILDERS: dict[type[BaseModel], Any] = {
    MissionPlan: _plan,
    AgentReport: _report,
    Critique: _critique,
    Rebuttal: _rebuttal,
    JudgeVerdict: _verdict,
    Directive: _directive,
}


def simulate(schema: type[T], context: dict[str, Any]) -> T:
    builder = _BUILDERS.get(schema)
    if builder is None:
        raise TypeError(f"simulator has no builder for {schema.__name__}")
    return cast(T, builder(context))
