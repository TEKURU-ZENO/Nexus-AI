"""Computed (not asserted) confidence.

The score combines the specialists' calibrated claim confidence with independent signals:
external evidence coverage, post-debate agreement, critic severity, and unresolved issues.
Simulated runs are capped so template output can never look authoritative.
"""

from __future__ import annotations

from statistics import fmean

from server.schemas.agents import RISK_WEIGHT, AgentReport, ConfidenceBreakdown, Critique, JudgeVerdict

SIMULATED_CAP = 40
GROUNDED_KINDS = {"web", "document", "memory"}


def compute_confidence(
    reports: dict[str, AgentReport],
    critiques: list[Critique],
    verdict: JudgeVerdict | None,
    *,
    simulated: bool,
) -> ConfidenceBreakdown:
    findings = [f for r in reports.values() for f in r.findings]
    finding_conf = fmean(f.confidence for f in findings) if findings else 0.0
    grounded = [f for f in findings if any(e.kind in GROUNDED_KINDS for e in f.evidence)]
    coverage = len(grounded) / len(findings) if findings else 0.0
    agreement = verdict.agreement if verdict else 0.5
    last = critiques[-1] if critiques else None
    critic_penalty = fmean(RISK_WEIGHT[c.severity] for c in last.challenges) if last else 0.0
    unresolved = len(verdict.unresolved_issues) if verdict else 0
    unresolved_penalty = min(0.2, 0.04 * unresolved)

    raw = (
        finding_conf * (0.7 + 0.3 * coverage) * (0.6 + 0.4 * agreement) * (1 - 0.3 * critic_penalty)
        - unresolved_penalty
    )
    score = round(max(0.0, min(1.0, raw)) * 100)
    if simulated:
        score = min(score, SIMULATED_CAP)

    parts = [
        f"claims {finding_conf:.0%} avg",
        f"{coverage:.0%} externally grounded",
        f"agreement {agreement:.0%}",
        f"critic severity {critic_penalty:.2f}",
        f"{unresolved} unresolved issue(s)",
    ]
    if simulated:
        parts.append(f"capped at {SIMULATED_CAP} (simulated output)")
    return ConfidenceBreakdown(
        score=score,
        finding_confidence=round(finding_conf, 3),
        evidence_coverage=round(coverage, 3),
        agreement=round(agreement, 3),
        critic_penalty=round(critic_penalty, 3),
        unresolved_penalty=round(unresolved_penalty, 3),
        simulated=simulated,
        explanation="; ".join(parts) + ".",
    )
