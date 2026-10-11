"""Thin async repository base. All Mongo access lives in app/repositories."""
from __future__ import annotations

from typing import Any

from pymongo import ReturnDocument

from app.db.client import get_db, sess
from app.utils.timefmt import utcnow


class BaseRepo:
    name: str = ""

    @property
    def col(self):
        return get_db()[self.name]

    async def get(self, _id: Any, session: Any = None, **extra) -> dict | None:
        return await self.col.find_one({"_id": _id, **extra}, **sess(session))

    async def find_one(self, filt: dict, session: Any = None) -> dict | None:
        return await self.col.find_one(filt, **sess(session))

    async def find(self, filt: dict, *, sort: list | None = None, skip: int = 0, limit: int = 0,
                   projection: dict | None = None, session: Any = None) -> list[dict]:
        cur = self.col.find(filt, projection, **sess(session))
        if sort:
            cur = cur.sort(sort)
        if skip:
            cur = cur.skip(skip)
        if limit:
            cur = cur.limit(limit)
        return await cur.to_list(None)

    async def count(self, filt: dict) -> int:
        return await self.col.count_documents(filt)

    async def insert(self, doc: dict, session: Any = None) -> dict:
        now = utcnow()
        doc.setdefault("created_at", now)
        doc.setdefault("updated_at", now)
        res = await self.col.insert_one(doc, **sess(session))
        doc["_id"] = res.inserted_id
        return doc

    async def update(self, filt: dict, update: dict, session: Any = None, *, bump: bool = True) -> dict | None:
        """find_one_and_update returning the new document; sets updated_at, bumps version."""
        update = {k: dict(v) if isinstance(v, dict) else v for k, v in update.items()}
        update.setdefault("$set", {})["updated_at"] = utcnow()
        if bump:
            update.setdefault("$inc", {})["version"] = 1
        return await self.col.find_one_and_update(filt, update, return_document=ReturnDocument.AFTER,
                                                  **sess(session))

    async def delete_one(self, filt: dict, session: Any = None) -> int:
        res = await self.col.delete_one(filt, **sess(session))
        return res.deleted_count
