"""LLM gateway: one interface over many providers (via LangChain chat models).

Responsibilities:
* ordered provider chain with automatic failover (OpenAI -> Anthropic -> ... -> simulator)
* schema-validated structured outputs with a repair retry on invalid output
* timeouts and transport retries (delegated to the LangChain clients)
* per-run token budgets and cost accounting
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol, TypeVar

import structlog
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, ValidationError

from server.core.config import Settings
from server.core.telemetry import LLM_CALLS, LLM_LATENCY, LLM_TOKENS
from server.llm.simulator import simulate

log = structlog.get_logger(__name__)

T = TypeVar("T", bound=BaseModel)

# USD per 1M tokens (input, output). Estimates for budgeting only; override via code/config as prices change.
PRICES: dict[str, tuple[float, float]] = {
    "gpt-5": (1.25, 10.0),
    "gpt-5-mini": (0.25, 2.0),
    "gpt-5-nano": (0.05, 0.4),
    "claude-opus-5-5": (5.0, 25.0),
    "claude-sonnet-5-5": (3.0, 15.0),
    "claude-haiku-5-5": (1.0, 5.0),
    "simulator": (0.0, 0.0),
}
DEFAULT_PRICE = (3.0, 15.0)


class BudgetExceeded(RuntimeError):
    pass


class AllProvidersFailed(RuntimeError):
    pass


@dataclass
class Budget:
    max_tokens: int
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    calls: int = 0

    @property
    def used(self) -> int:
        return self.input_tokens + self.output_tokens

    def check(self) -> None:
        if self.used >= self.max_tokens:
            raise BudgetExceeded(f"run token budget exhausted ({self.used}/{self.max_tokens})")

    def record(self, model: str, input_tokens: int, output_tokens: int) -> None:
        # Self-hosted models (Ollama) have no per-token price.
        price_in, price_out = (0.0, 0.0) if model.startswith("ollama/") else PRICES.get(model, DEFAULT_PRICE)
        self.input_tokens += input_tokens
        self.output_tokens += output_tokens
        self.cost_usd += (input_tokens * price_in + output_tokens * price_out) / 1_000_000
        self.calls += 1


@dataclass
class LLMResult[T]:
    value: T
    provider: str
    model: str
    simulated: bool
    degraded_from: list[str] = field(default_factory=list)


class Provider(Protocol):
    name: str
    model: str

    async def invoke(self, schema: type[T], messages: list[BaseMessage]) -> tuple[T, int, int]:
        """Return (parsed, input_tokens, output_tokens). Raise on transport or parse failure."""
        ...


class LangChainProvider:
    """Wraps any LangChain chat model that supports tool-calling structured output."""

    def __init__(
        self,
        name: str,
        model: str,
        chat_model: BaseChatModel,
        method: Literal["function_calling", "json_schema"] = "function_calling",
    ) -> None:
        self.name = name
        self.model = model
        self._chat = chat_model
        self._method = method

    async def invoke(self, schema: type[T], messages: list[BaseMessage]) -> tuple[T, int, int]:
        runnable = self._chat.with_structured_output(schema, method=self._method, include_raw=True)
        out: dict[str, Any] = await runnable.ainvoke(messages)  # type: ignore[assignment]
        if out.get("parsing_error") or out.get("parsed") is None:
            raise ValueError(f"structured output invalid: {out.get('parsing_error')}")
        usage = getattr(out.get("raw"), "usage_metadata", None) or {}
        parsed = out["parsed"]
        if not isinstance(parsed, schema):
            parsed = schema.model_validate(parsed)
        return parsed, int(usage.get("input_tokens", 0)), int(usage.get("output_tokens", 0))


def build_providers(settings: Settings) -> list[Provider]:
    providers: list[Provider] = []
    for name in settings.llm_providers:
        if name == "openai" and settings.openai_api_key:
            from langchain_openai import ChatOpenAI

            kwargs: dict[str, Any] = {
                "model": settings.openai_model,
                "api_key": settings.openai_api_key.get_secret_value(),
                "timeout": settings.llm_timeout_s,
                "max_retries": settings.llm_max_retries,
                "max_completion_tokens": settings.llm_max_output_tokens,
            }
            if settings.llm_temperature is not None:
                kwargs["temperature"] = settings.llm_temperature
            providers.append(LangChainProvider("openai", settings.openai_model, ChatOpenAI(**kwargs)))
        elif name == "anthropic" and settings.anthropic_api_key:
            from langchain_anthropic import ChatAnthropic

            kwargs = {
                "model": settings.anthropic_model,
                "api_key": settings.anthropic_api_key.get_secret_value(),
                "timeout": settings.llm_timeout_s,
                "max_retries": settings.llm_max_retries,
                "max_tokens": settings.llm_max_output_tokens,
            }
            if settings.llm_temperature is not None:
                kwargs["temperature"] = settings.llm_temperature
            providers.append(LangChainProvider("anthropic", settings.anthropic_model, ChatAnthropic(**kwargs)))
        elif name == "ollama" and settings.ollama_model:
            from langchain_ollama import ChatOllama

            # json_schema → Ollama constrained decoding: far more reliable than tool calls on small local models.
            chat = ChatOllama(
                model=settings.ollama_model,
                base_url=settings.ollama_base_url,
                num_ctx=settings.ollama_num_ctx,
                num_predict=settings.llm_max_output_tokens,
                temperature=settings.llm_temperature if settings.llm_temperature is not None else 0.2,
                client_kwargs={"timeout": settings.llm_timeout_s},
            )
            providers.append(LangChainProvider("ollama", f"ollama/{settings.ollama_model}", chat, method="json_schema"))
    return providers


class LLMGateway:
    def __init__(
        self,
        providers: list[Provider],
        *,
        allow_simulator: bool = True,
        on_degrade: Callable[[str, str], None] | None = None,
    ) -> None:
        self.providers = providers
        self.allow_simulator = allow_simulator
        self.on_degrade = on_degrade

    @property
    def live_provider_names(self) -> list[str]:
        return [p.name for p in self.providers]

    @property
    def simulator_only(self) -> bool:
        return not self.providers

    async def structured(
        self,
        schema: type[T],
        *,
        system: str,
        user: str,
        budget: Budget,
        sim_context: dict[str, Any],
    ) -> LLMResult[T]:
        budget.check()
        messages: list[BaseMessage] = [SystemMessage(system), HumanMessage(user)]
        failed: list[str] = []

        for provider in self.providers:
            for attempt in range(2):  # 1 call + 1 repair retry on invalid structure
                started = time.perf_counter()
                try:
                    parsed, tin, tout = await provider.invoke(schema, messages)
                except (ValidationError, ValueError) as exc:
                    LLM_CALLS.labels(provider.name, "invalid").inc()
                    if attempt == 0:
                        messages = [
                            *messages,
                            HumanMessage(
                                f"Your previous output failed validation: {str(exc)[:500]}. Return output that strictly matches the schema."
                            ),
                        ]
                        continue
                    failed.append(provider.name)
                    break
                except Exception as exc:  # noqa: BLE001 - transport/auth/quota errors -> next provider
                    LLM_CALLS.labels(provider.name, "error").inc()
                    log.warning(
                        "llm.provider_failed", provider=provider.name, error=type(exc).__name__, detail=str(exc)[:300]
                    )
                    failed.append(provider.name)
                    if self.on_degrade:
                        self.on_degrade(provider.name, type(exc).__name__)
                    break
                LLM_CALLS.labels(provider.name, "ok").inc()
                LLM_LATENCY.labels(provider.name).observe(time.perf_counter() - started)
                LLM_TOKENS.labels(provider.name, "input").inc(tin)
                LLM_TOKENS.labels(provider.name, "output").inc(tout)
                budget.record(provider.model, tin, tout)
                return LLMResult(parsed, provider.name, provider.model, simulated=False, degraded_from=failed)

        if not self.allow_simulator:
            raise AllProvidersFailed(f"all providers failed: {failed}")
        value = simulate(schema, sim_context)
        budget.record("simulator", 0, 0)
        LLM_CALLS.labels("simulator", "ok").inc()
        return LLMResult(value, "simulator", "simulator", simulated=True, degraded_from=failed)
