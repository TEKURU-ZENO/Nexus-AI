"""HTTP request/response contracts (exported to the frontend via OpenAPI)."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from server.schemas.agents import (
    AgentReport,
    ConfidenceBreakdown,
    Critique,
    Directive,
    JudgeVerdict,
    MissionPlan,
    Rebuttal,
)


class MissionMode(StrEnum):
    STRATEGIC_PLANNING = "Strategic Planning"
    STARTUP_VALIDATION = "Startup Validation"
    TECHNICAL_ARCHITECTURE = "Technical Architecture"
    RISK_ANALYSIS = "Risk Analysis"
    PRODUCT_ROADMAPPING = "Product Roadmapping"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DecisionStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    CHALLENGED = "challenged"
    REJECTED = "rejected"


class RunCreate(BaseModel):
    mission: str = Field(min_length=10, max_length=4000)
    mode: MissionMode = MissionMode.STRATEGIC_PLANNING
    refinement: str | None = Field(default=None, max_length=1000)
    parent_run_id: str | None = None
    project: str = Field(default="default", min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")

    @field_validator("mission", "refinement")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class Usage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    llm_calls: int = 0


class RunResult(BaseModel):
    plan: MissionPlan | None = None
    reports: dict[str, AgentReport] = Field(default_factory=dict)
    critiques: list[Critique] = Field(default_factory=list)
    rebuttals: list[Rebuttal] = Field(default_factory=list)
    verdict: JudgeVerdict | None = None
    directive: Directive | None = None
    confidence: ConfidenceBreakdown | None = None
    memory_used: list[str] = Field(default_factory=list)
    safety_flags: list[str] = Field(default_factory=list)


class RunSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mission: str
    mode: MissionMode
    project: str
    status: RunStatus
    decision_status: DecisionStatus
    confidence: int | None = None
    simulated: bool
    parent_run_id: str | None = None
    created_at: datetime
    finished_at: datetime | None = None


class RunDetail(RunSummary):
    refinement: str | None = None
    result: RunResult | None = None
    usage: Usage
    providers: list[str] = Field(default_factory=list)
    prompt_versions: dict[str, str] = Field(default_factory=dict)
    error: str | None = None


class RunEvent(BaseModel):
    seq: int
    type: str
    agent: str | None = None
    message: str = ""
    data: dict[str, Any] | None = None
    at: datetime


class DecisionRequest(BaseModel):
    status: Literal["accepted", "rejected", "challenged"]
    note: str | None = Field(default=None, max_length=1000)


class DecisionResponse(BaseModel):
    run_id: str
    status: DecisionStatus
    memory_committed: bool
    challenge_run_id: str | None = None
    detail: str


class MemoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project: str
    content: str
    source_run_id: str | None
    created_at: datetime


class AuditEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    actor: str
    action: str
    target: str | None
    detail: dict[str, Any] | None
    created_at: datetime


class AgentInfo(BaseModel):
    id: str
    name: str
    role: str
    description: str
    prompt_version: str


class HealthResponse(BaseModel):
    status: Literal["online", "degraded"]
    system: str
    version: str
    live_providers: list[str]
    simulator_only: bool
    auth_mode: str
    database: Literal["ok", "error"]


class Me(BaseModel):
    user_id: str
    email: str | None
    org_id: str
    roles: list[str]
    permissions: list[str]


class CalibrationBucket(BaseModel):
    bucket: str
    runs: int
    accepted: int
    acceptance_rate: float | None


class CalibrationReport(BaseModel):
    buckets: list[CalibrationBucket]
    expected_calibration_error: float | None
    decided_runs: int
