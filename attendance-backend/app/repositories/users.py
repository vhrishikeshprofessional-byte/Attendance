from __future__ import annotations

import re
from typing import Any

from bson import ObjectId

from app.db.client import sess
from app.repositories.base import BaseRepo


class UsersRepo(BaseRepo):
    name = "users"

    async def find_by_login(self, identifier: str) -> dict | None:
        ident = identifier.strip()
        return await self.col.find_one({"$or": [{"work_email": ident.lower()}, {"employee_id": ident.upper()}],
                                        "is_deleted": {"$ne": True}})

    async def resolve(self, ident: str, session: Any = None, include_deleted: bool = False) -> dict | None:
        """Look up by ObjectId or by employee code (e.g. EMP-000123)."""
        filt: dict = {"employee_id": ident.strip().upper()}
        if ObjectId.is_valid(ident):
            filt = {"_id": ObjectId(ident)}
        if not include_deleted:
            filt["is_deleted"] = {"$ne": True}
        return await self.col.find_one(filt, **sess(session))

    async def many_by_ids(self, ids: list[ObjectId], projection: dict | None = None) -> dict[ObjectId, dict]:
        if not ids:
            return {}
        rows = await self.find({"_id": {"$in": list(set(ids))}}, projection=projection)
        return {r["_id"]: r for r in rows}

    @staticmethod
    def search_filter(q: str | None) -> dict:
        if not q:
            return {}
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        return {"$or": [{"personal.full_name": rx}, {"work_email": rx}, {"employee_id": rx}]}


users_repo = UsersRepo()
