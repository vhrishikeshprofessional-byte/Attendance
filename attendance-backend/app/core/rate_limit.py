"""In-memory sliding-window rate limiter (swap the store for Redis when scaling out)."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Request

from app.config import settings
from app.core.errors import TooManyRequests

_hits: dict[str, deque] = defaultdict(deque)


def reset_rate_limits() -> None:
    _hits.clear()


class RateLimit:
    def __init__(self, scope: str, limit: int, window_seconds: int):
        self.scope, self.limit, self.window = scope, limit, window_seconds

    async def __call__(self, request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return
        ip = request.client.host if request.client else "unknown"
        key, now = f"{self.scope}:{ip}", time.monotonic()
        q = _hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            retry = max(1, int(self.window - (now - q[0])))
            raise TooManyRequests("Too many requests. Try again later.", headers={"Retry-After": str(retry)})
        q.append(now)
