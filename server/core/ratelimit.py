"""Per-principal token-bucket rate limiting (in-process).

For multi-instance deployments, back this with Redis; the interface stays the same.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from fastapi import HTTPException, status


@dataclass
class _Bucket:
    tokens: float
    updated: float


class RateLimiter:
    def __init__(self, per_minute: int) -> None:
        self.capacity = float(max(1, per_minute))
        self.rate = self.capacity / 60.0
        self._buckets: dict[str, _Bucket] = {}

    def hit(self, key: str) -> None:
        now = time.monotonic()
        bucket = self._buckets.get(key) or _Bucket(self.capacity, now)
        bucket.tokens = min(self.capacity, bucket.tokens + (now - bucket.updated) * self.rate)
        bucket.updated = now
        if bucket.tokens < 1:
            retry = int((1 - bucket.tokens) / self.rate) + 1
            self._buckets[key] = bucket
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS, "rate limit exceeded", headers={"Retry-After": str(retry)}
            )
        bucket.tokens -= 1
        self._buckets[key] = bucket
