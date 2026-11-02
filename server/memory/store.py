"""Scoped long-term memory.

* Scoped per organisation + project; never shared across tenants.
* Only *accepted* decisions from *non-simulated* runs are committed.
* Retrieval is similarity-based with a relevance threshold. The default embedder is a deterministic
  feature-hashing model (no network); set USE_PROVIDER_EMBEDDINGS=true to use OpenAI embeddings.
  On Postgres, swapping the JSON column for pgvector is a drop-in optimisation.
"""

from __future__ import annotations

import hashlib
import itertools
import math
import re
from typing import Protocol

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.config import Settings
from server.db.models import MemoryRow
from server.engine.safety import sanitize_for_memory

DIM = 384
_TOKEN = re.compile(r"[a-z0-9]{3,}")


class Embedder(Protocol):
    async def embed(self, text: str) -> list[float]: ...


class HashingEmbedder:
    """Signed feature hashing over unigrams + bigrams, L2-normalised."""

    async def embed(self, text: str) -> list[float]:
        tokens = _TOKEN.findall(text.lower())
        grams = tokens + [f"{a}_{b}" for a, b in itertools.pairwise(tokens)]
        vec = [0.0] * DIM
        for gram in grams:
            h = int(hashlib.blake2b(gram.encode(), digest_size=8).hexdigest(), 16)
            vec[h % DIM] += 1.0 if (h >> 32) & 1 else -1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [round(v / norm, 5) for v in vec]


class ProviderEmbedder:
    def __init__(self, settings: Settings) -> None:
        from langchain_openai import OpenAIEmbeddings

        assert settings.openai_api_key
        self._emb = OpenAIEmbeddings(model="text-embedding-3-small", api_key=settings.openai_api_key)  # type: ignore[call-arg]

    async def embed(self, text: str) -> list[float]:
        return await self._emb.aembed_query(text)


def build_embedder(settings: Settings) -> Embedder:
    if settings.use_provider_embeddings and settings.openai_api_key:
        return ProviderEmbedder(settings)
    return HashingEmbedder()


def cosine(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


class MemoryStore:
    def __init__(self, embedder: Embedder, *, min_similarity: float, top_k: int) -> None:
        self.embedder = embedder
        self.min_similarity = min_similarity
        self.top_k = top_k

    async def recall(self, session: AsyncSession, org_id: str, project: str, query: str) -> list[str]:
        rows = (
            await session.scalars(
                select(MemoryRow)
                .where(MemoryRow.org_id == org_id, MemoryRow.project == project)
                .order_by(MemoryRow.created_at.desc())
                .limit(500)
            )
        ).all()
        if not rows:
            return []
        q = await self.embedder.embed(query)
        scored = sorted(((cosine(q, r.embedding), r.content) for r in rows), reverse=True)
        return [content for score, content in scored[: self.top_k] if score >= self.min_similarity]

    async def commit(
        self, session: AsyncSession, org_id: str, project: str, content: str, run_id: str | None
    ) -> MemoryRow:
        clean = sanitize_for_memory(content)
        row = MemoryRow(
            org_id=org_id,
            project=project,
            content=clean,
            embedding=await self.embedder.embed(clean),
            source_run_id=run_id,
        )
        session.add(row)
        await session.flush()
        return row

    async def list(self, session: AsyncSession, org_id: str, project: str | None = None) -> list[MemoryRow]:
        stmt = select(MemoryRow).where(MemoryRow.org_id == org_id)
        if project:
            stmt = stmt.where(MemoryRow.project == project)
        return list((await session.scalars(stmt.order_by(MemoryRow.created_at.desc()).limit(200))).all())

    async def delete(self, session: AsyncSession, org_id: str, memory_id: str) -> bool:
        result = await session.execute(delete(MemoryRow).where(MemoryRow.org_id == org_id, MemoryRow.id == memory_id))
        return bool(getattr(result, "rowcount", 0))
