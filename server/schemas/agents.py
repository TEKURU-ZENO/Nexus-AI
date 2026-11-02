"""Structured agent contracts. Every LLM call returns one of these, validated by Pydantic."""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class Risk(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


RISK_WEIGHT: dict[Risk, float] = {Risk.LOW: 0.1, Risk.MEDIUM: 0.35, Risk.HIGH: 0.65, Risk.CRITICAL: 0.9}

EvidenceKind = Literal["web", "document", "memory", "model_knowledge"]


class Evidence(BaseModel):
    kind: EvidenceKind = Field(description="Where this evidence comes from.")
    summary: str = Field(description="What the evidence says, in one sentence.")
    source_title: str | None = Field(default=None, description="Title of the source, if any.")
    url: str | None = Field(default=None, description="URL of the source, only if it was provided to you.")


class Finding(BaseModel):
    claim: str = Field(description="A specific, falsifiable claim about this mission.")
    rationale: str = Field(description="Why the claim holds.")
    evidence: list[Evidence] = Field(default_factory=list)
    risk: Risk = Risk.MEDIUM
    confidence: float = Field(ge=0.0, le=1.0, description="Your calibrated probability the claim is true.")
    recommendation: str = Field(description="The concrete action this finding implies.")


class Workstream(BaseModel):
    agent_id: Literal["researcher", "architect", "strategist"]
    question: str = Field(description="The specific question this specialist must answer.")
    priority: int = Field(ge=1, le=3, default=2)


class MissionPlan(BaseModel):
    objective: str = Field(description="The mission restated as a measurable objective.")
    workstreams: list[Workstream] = Field(min_length=1, max_length=6)
    key_assumptions: list[str] = Field(default_factory=list, max_length=6)
    success_criteria: list[str] = Field(default_factory=list, max_length=6)


class AgentReport(BaseModel):
    agent_id: str
    summary: str = Field(description="Two to three sentence summary of this agent's analysis.")
    findings: list[Finding] = Field(min_length=1, max_length=6)
    open_questions: list[str] = Field(default_factory=list, max_length=5)


class Challenge(BaseModel):
    target_agent: Literal["researcher", "architect", "strategist", "plan"]
    claim: str = Field(description="The claim being challenged, quoted or paraphrased.")
    severity: Risk
    reasoning: str
    proof_required: str = Field(description="What evidence would resolve this challenge.")


class Critique(BaseModel):
    most_dangerous_assumption: str
    challenges: list[Challenge] = Field(min_length=1, max_length=6)
    overall_risk: Risk


class RebuttalItem(BaseModel):
    challenge_index: int = Field(ge=0)
    position: Literal["concede", "defend", "revise"]
    argument: str
    revised_claim: str | None = None


class Rebuttal(BaseModel):
    responses: list[RebuttalItem] = Field(min_length=1)


class JudgeVerdict(BaseModel):
    resolved: bool = Field(description="True if the remaining disagreements do not block a decision.")
    agreement: float = Field(ge=0.0, le=1.0, description="Degree of consensus after the debate.")
    unresolved_issues: list[str] = Field(default_factory=list, max_length=6)
    notes: str = ""


class Phase(BaseModel):
    name: str
    goal: str
    actions: list[str] = Field(min_length=1, max_length=6)
    exit_criteria: str


class KPI(BaseModel):
    name: str
    target: str
    measurement: str


class OwnedRisk(BaseModel):
    risk: str
    severity: Risk
    owner: str = Field(description="Role accountable for this risk (e.g. 'Head of Product').")
    mitigation: str


class Directive(BaseModel):
    title: str
    decision: str = Field(description="One decisive sentence: what to do.")
    rationale: str
    tradeoffs: list[str] = Field(min_length=1, max_length=6)
    phases: list[Phase] = Field(min_length=1, max_length=5)
    kpis: list[KPI] = Field(min_length=1, max_length=6)
    risks: list[OwnedRisk] = Field(min_length=1, max_length=6)
    next_actions: list[str] = Field(min_length=1, max_length=8)


class ConfidenceBreakdown(BaseModel):
    score: int = Field(ge=0, le=100)
    finding_confidence: float
    evidence_coverage: float
    agreement: float
    critic_penalty: float
    unresolved_penalty: float
    simulated: bool
    explanation: str
