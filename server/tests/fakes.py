from __future__ import annotations

import asyncio
from typing import Any, TypeVar

from langchain_core.messages import BaseMessage
from pydantic import BaseModel

from server.llm.simulator import simulate
from server.schemas.agents import AgentReport, Evidence

T = TypeVar("T", bound=BaseModel)


class FakeProvider:
    """A 'live' provider stand-in: deterministic structured output, configurable failures."""

    def __init__(
        self,
        name: str = "fake",
        *,
        model: str = "gpt-5-mini",
        fail: Exception | None = None,
        invalid_first: bool = False,
        delay: float = 0.0,
        tokens: tuple[int, int] = (100, 50),
        hallucinate_url: bool = False,
    ) -> None:
        self.name, self.model = name, model
        self.fail, self.invalid_first, self.delay, self.tokens = fail, invalid_first, delay, tokens
        self.hallucinate_url = hallucinate_url
        self.calls = 0

    async def invoke(self, schema: type[T], messages: list[BaseMessage]) -> tuple[T, int, int]:
        self.calls += 1
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.fail:
            raise self.fail
        if self.invalid_first and self.calls == 1:
            raise ValueError("structured output invalid: missing field")
        ctx: dict[str, Any] = {"mission": str(messages[-1].content)[:200], "mode": "Strategic Planning"}
        value = simulate(schema, ctx)
        if self.hallucinate_url and isinstance(value, AgentReport):
            value.findings[0].evidence.append(Evidence(kind="web", summary="made up", url="https://fake.example/stat"))
        return value, *self.tokens  # type: ignore[return-value]
