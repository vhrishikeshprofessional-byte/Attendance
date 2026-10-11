"""Mongo-based lock (single-runner for scheduled jobs) and atomic counters."""
from __future__ import annotations

from datetime import timedelta

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.db.client import get_db
from app.utils.timefmt import utcnow


async def acquire_lock(name: str, ttl_seconds: int, owner: str) -> bool:
    col, now = get_db()["locks"], utcnow()
    try:
        res = await col.find_one_and_update(
            {"_id": name, "$or": [{"expires_at": {"$lt": now}}, {"owner": owner}]},
            {"$set": {"owner": owner, "expires_at": now + timedelta(seconds=ttl_seconds)}},
            upsert=True, return_document=ReturnDocument.AFTER)
        return res is not None and res.get("owner") == owner
    except DuplicateKeyError:
        return False


async def release_lock(name: str, owner: str) -> None:
    await get_db()["locks"].delete_one({"_id": name, "owner": owner})


async def next_sequence(name: str) -> int:
    res = await get_db()["counters"].find_one_and_update(
        {"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    return int(res["seq"])
