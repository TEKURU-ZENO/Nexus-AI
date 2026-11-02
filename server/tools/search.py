"""Web search tool for grounding. Uses Tavily when TAVILY_API_KEY is set; otherwise returns nothing,
so findings are honestly labelled `model_knowledge` and confidence is penalised."""

from __future__ import annotations

from dataclasses import dataclass

import httpx
import structlog

from server.core.config import Settings

log = structlog.get_logger(__name__)


@dataclass(frozen=True)
class SearchHit:
    title: str
    url: str
    snippet: str


class SearchTool:
    def __init__(self, settings: Settings) -> None:
        self._key = settings.tavily_api_key.get_secret_value() if settings.tavily_api_key else None
        self._max = settings.search_max_results

    @property
    def enabled(self) -> bool:
        return self._key is not None

    async def search(self, query: str) -> list[SearchHit]:
        if not self._key:
            return []
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.tavily.com/search",
                    json={"query": query[:400], "max_results": self._max, "search_depth": "basic"},
                    headers={"Authorization": f"Bearer {self._key}"},
                )
                resp.raise_for_status()
                data = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("search.failed", error=type(exc).__name__)
            return []
        return [
            SearchHit(
                title=str(r.get("title", ""))[:200], url=str(r.get("url", "")), snippet=str(r.get("content", ""))[:600]
            )
            for r in data.get("results", [])
            if r.get("url")
        ]
