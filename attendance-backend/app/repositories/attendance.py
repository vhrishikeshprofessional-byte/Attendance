from __future__ import annotations

from datetime import datetime
from typing import Any

from bson import ObjectId

from app.db.client import sess
from app.repositories.base import BaseRepo


class AttendanceRepo(BaseRepo):
    name = "attendance"

    async def find_overlap(self, employee: ObjectId, entry: datetime, exit_: datetime | None,
                           exclude_id: ObjectId | None = None, session: Any = None) -> dict | None:
        """Live session overlapping [entry, exit_) (exit_=None means open-ended)."""
        filt: dict = {"employee_id": employee, "is_deleted": False,
                      "$or": [{"is_open": True}, {"exit_time": {"$gt": entry}}]}
        if exit_ is not None:
            filt["entry_time"] = {"$lt": exit_}
        if exclude_id is not None:
            filt["_id"] = {"$ne": exclude_id}
        return await self.col.find_one(filt, **sess(session))

    async def find_open(self, employee: ObjectId, session: Any = None) -> dict | None:
        return await self.col.find_one({"employee_id": employee, "is_open": True, "is_deleted": False},
                                       **sess(session))


attendance_repo = AttendanceRepo()
