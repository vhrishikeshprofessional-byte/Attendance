"""MongoDB client (async PyMongo) and transaction helper."""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from pymongo import AsyncMongoClient

from app.config import settings

_client: Any = None


def init_client(client: Any = None) -> Any:
    global _client
    _client = client or AsyncMongoClient(settings.MONGO_URI, tz_aware=True, serverSelectionTimeoutMS=5000)
    return _client


def get_client() -> Any:
    if _client is None:
        raise RuntimeError("Mongo client not initialised")
    return _client


def get_db() -> Any:
    return get_client()[settings.MONGO_DB]


async def close_client() -> None:
    global _client
    if _client is not None:
        res = _client.close()
        if hasattr(res, "__await__"):
            await res
        _client = None


def sess(session: Any) -> dict:
    return {"session": session} if session is not None else {}


async def run_txn(callback: Callable[[Any], Awaitable[Any]]) -> Any:
    """Run `callback(session)` in a transaction; session=None when USE_TRANSACTIONS=false."""
    if not settings.USE_TRANSACTIONS:
        return await callback(None)
    async with get_client().start_session() as session:
        return await session.with_transaction(callback)


async def aggregate(col: Any, pipeline: list[dict], session: Any = None) -> list[dict]:
    res = col.aggregate(pipeline, **sess(session))
    if hasattr(res, "__await__"):
        res = await res
    return await res.to_list(None)
