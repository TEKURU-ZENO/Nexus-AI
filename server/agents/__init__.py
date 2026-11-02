"""Single source of truth for the agent roster (served to the UI via /api/v1/agents)."""

from __future__ import annotations

from dataclasses import dataclass

from server.prompts import load_prompt


@dataclass(frozen=True)
class AgentSpec:
    id: str
    name: str
    role: str
    description: str
    prompt_id: str

    @property
    def prompt_version(self) -> str:
        return load_prompt(self.prompt_id).version


AGENTS: list[AgentSpec] = [
    AgentSpec(
        "orchestrator",
        "Orchestrator",
        "Mission control",
        "Decomposes the mission into a plan and routes workstreams.",
        "orchestrator",
    ),
    AgentSpec(
        "researcher",
        "Researcher",
        "Signal discovery",
        "Maps users, market, evidence, and regulation (with web search when configured).",
        "researcher",
    ),
    AgentSpec(
        "architect",
        "Architect",
        "System design",
        "Designs the smallest trustworthy system: flows, data, controls.",
        "architect",
    ),
    AgentSpec(
        "strategist", "Strategist", "Growth logic", "Defines wedge, pricing, go-to-market, and retention.", "strategist"
    ),
    AgentSpec("critic", "Critic", "Threat analysis", "Attacks assumptions and demands proof.", "critic"),
    AgentSpec(
        "judge", "Judge", "Debate resolution", "Scores consensus and decides whether the debate is resolved.", "judge"
    ),
    AgentSpec(
        "synthesizer",
        "Synthesizer",
        "Decision directive",
        "Writes the final directive from findings and debate.",
        "synthesizer",
    ),
    AgentSpec(
        "memory", "Memory", "Context fabric", "Recalls accepted decisions scoped to your project.", "orchestrator"
    ),
]
AGENTS_BY_ID = {a.id: a for a in AGENTS}
SPECIALISTS = ("researcher", "architect", "strategist")
