import asyncio
import json
from typing import AsyncIterator

from server.agents.architect import ARCHITECT
from server.agents.critic import CRITIC
from server.agents.orchestrator import ORCHESTRATOR
from server.agents.researcher import RESEARCHER
from server.agents.strategist import STRATEGIST
from server.services.memory_store import recall, remember
from server.services.openai_service import openai_service

AGENT_ORDER = [ORCHESTRATOR, RESEARCHER, ARCHITECT, STRATEGIST]


def fallback_output(agent: dict, mission: str, mode: str, remembered: list[str]) -> str:
    memory_note = " Prior related mission detected." if remembered else ""
    outputs = {
        "orchestrator": (
            f"Mode: {mode}. Workstreams: diagnostic failure patterns, buyer wedge, workflow architecture, "
            f"go-to-market, risk matrix, and decision synthesis.{memory_note} Dependency Map: Research validates "
            "the wedge before architecture and GTM harden. Confidence: 91. Recommendation: keep the first workflow "
            "narrow enough to prove measurable strategic value."
        ),
        "researcher": (
            "Risk Level: MEDIUM. Observation: diagnostic error is expensive, frequent, and operationally fragmented. "
            "Strategic Opportunity: smaller diagnostic clinics and specialty networks can adopt faster than large hospitals. "
            "Recommendation: validate one high-frequency failure pattern with accessible pilots and clear before/after metrics. "
            "Confidence: 88."
        ),
        "architect": (
            "Risk Level: MEDIUM. Observation: the system must earn trust before it expands autonomy. Strategic Opportunity: "
            "a supervised workflow with evidence trails can reduce review burden without replacing clinical judgment. "
            "Recommendation: ship mission intake, agent routing, evidence ledger, decision locks, confidence labels, and exportable review packets. "
            "Confidence: 86."
        ),
        "strategist": (
            "Risk Level: MEDIUM. Observation: buyers will punish vague AI claims and reward measurable risk reduction. "
            "Strategic Opportunity: sell supervised review acceleration before selling diagnostic automation. Recommendation: "
            "land concierge pilots, convert outcomes into case studies, then expand through templates and recurring intelligence reviews. "
            "Confidence: 87."
        ),
        "critic": (
            "Risk Level: HIGH. Most Dangerous Assumption: users will trust an AI-native workflow because the interface feels advanced. "
            "Reasoning: healthcare adoption depends on incentives, liability boundaries, clinical proof, and procurement trust. "
            "Proof Required: pilot data showing fewer missed review steps, faster escalation, and no unsafe automation drift. "
            "Recommendation: force every major claim through evidence, owner, metric, and rollback criteria."
        ),
    }
    return outputs.get(agent["id"], f"{agent['name']} completed analysis for {mission}.")


async def emit_agent(agent: dict, mission: str, mode: str, remembered: list[str]) -> AsyncIterator[dict]:
    yield {"type": "agent_start", "agent": agent["id"], "message": f"{agent['name']} activated."}
    await asyncio.sleep(0.2)

    if openai_service.enabled:
        prompt = (
            f"Mission: {mission}\n"
            f"Mission mode: {mode}\n"
            f"Relevant memory: {remembered or 'none'}\n\n"
            "Produce concise, high-signal analysis for an AI-native strategic workflow platform. "
            "Format with: Risk Level, Observation, Strategic Opportunity, Recommendation, Confidence. "
            "Be specific, decisive, practical, and avoid AGI fantasy language."
        )
        output = ""
        async for delta in openai_service.stream_text(agent["prompt"], prompt):
            output += delta
            yield {"type": "agent_delta", "agent": agent["id"], "message": delta}
        if not output.strip():
            output = fallback_output(agent, mission, mode, remembered)
            yield {"type": "agent_delta", "agent": agent["id"], "message": output}
    else:
        output = fallback_output(agent, mission, mode, remembered)
        for sentence in output.split(". "):
            chunk = sentence if sentence.endswith(".") else sentence + "."
            yield {"type": "agent_delta", "agent": agent["id"], "message": chunk + " "}
            await asyncio.sleep(0.32)

    yield {"type": "agent_done", "agent": agent["id"], "message": output}


def section(label: str, text: str, risk: str, recommendation: str) -> dict:
    return {
        "label": label,
        "text": text[:320],
        "risk": risk,
        "recommendation": recommendation,
    }


async def stream_mission(mission: str, mode: str = "Strategic Planning") -> AsyncIterator[dict]:
    remembered = recall(mission)
    yield {"type": "mission_start", "agent": "orchestrator", "message": f"{mode} mission accepted: {mission}"}
    if remembered:
        yield {
            "type": "memory_recall",
            "agent": "memory",
            "message": f"Memory recall: {remembered[0]}",
            "memory": remembered,
        }

    agent_outputs: dict[str, str] = {}
    for agent in AGENT_ORDER:
        output_parts = []
        async for event in emit_agent(agent, mission, mode, remembered):
            if event["type"] == "agent_delta":
                output_parts.append(event["message"])
            yield event
        agent_outputs[agent["id"]] = "".join(output_parts).strip()

    debate_context = json.dumps(agent_outputs, indent=2)
    critic_prompt = (
        f"Mission: {mission}\nMission mode: {mode}\nAgent outputs:\n{debate_context}\n\n"
        "Attack the plan with useful skepticism. Detect scalability issues, weak business models, unrealistic assumptions, "
        "technical bottlenecks, regulatory concerns, and missing user incentives. Format with: Risk Level, Most Dangerous Assumption, "
        "Reasoning, Proof Required, Recommendation."
    )
    yield {"type": "debate_start", "agent": "critic", "message": "Debate engine opening adversarial review."}
    critic_text = ""
    if openai_service.enabled:
        async for delta in openai_service.stream_text(CRITIC["prompt"], critic_prompt):
            critic_text += delta
            yield {"type": "debate_delta", "agent": "critic", "message": delta}
    if not critic_text.strip():
        critic_text = fallback_output(CRITIC, mission, mode, remembered)
        yield {"type": "debate_delta", "agent": "critic", "message": critic_text}

    synthesis = {
        "title": f"{mode} Directive",
        "confidence": 91,
        "sections": [
            section(
                "Problem Wedge",
                agent_outputs.get("researcher", ""),
                "Medium",
                "Validate one painful segment with measurable urgency before broadening scope.",
            ),
            section(
                "Workflow Architecture",
                agent_outputs.get("architect", ""),
                "Medium",
                "Prioritize auditability, review controls, and decision locks over autonomous breadth.",
            ),
            section(
                "Go-To-Market",
                agent_outputs.get("strategist", ""),
                "Medium",
                "Run founder-led pilots, publish proof, then productize recurring strategic reviews.",
            ),
            section(
                "Critical Risks",
                critic_text,
                "High",
                "Attach every risky claim to evidence, metric, owner, and rollback criteria.",
            ),
        ],
    }
    summary = f"{synthesis['sections'][0]['text']} Threat: {synthesis['sections'][-1]['text']}"
    remember(mission, summary)
    yield {"type": "memory_commit", "agent": "memory", "message": f"Memory committed: {summary[:180]}"}
    yield {"type": "mission_complete", "agent": "orchestrator", "message": "Synthesis complete.", "report": synthesis}
