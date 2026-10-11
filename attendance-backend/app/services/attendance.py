"""Attendance use-cases. Stored times are UTC; date/week_start are IST ISO strings."""
from __future__ import annotations

import datetime as dt
from datetime import timedelta
from typing import Any

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.config import settings
from app.core.errors import Conflict, NotFound, Unprocessable
from app.db.client import run_txn
from app.repositories.attendance import attendance_repo
from app.repositories.users import users_repo
from app.services.audit import log_audit
from app.utils.timefmt import as_utc, ist_date, utcnow
from app.utils.weeks import week_start_of


def _max_td() -> timedelta:
    return timedelta(hours=settings.MAX_SESSION_HOURS)


def session_fields(entry: dt.datetime, exit_: dt.datetime | None) -> dict:
    """Build derived fields consistently for every attendance write."""
    day = ist_date(entry)
    return {
        "entry_time": entry,
        "exit_time": exit_,
        "is_open": exit_ is None,
        "date": day.isoformat(),
        "week_start": week_start_of(day).isoformat(),
        "duration_minutes": int((exit_ - entry).total_seconds() // 60) if exit_ else None,
    }


def validate_times(
    entry: dt.datetime, exit_: dt.datetime | None, now: dt.datetime | None = None
) -> None:
    now = now or utcnow()
    limit = now + timedelta(seconds=settings.FUTURE_TIME_TOLERANCE_SECONDS)
    if entry > limit:
        raise Unprocessable("Entry time cannot be in the future", code="FUTURE_TIME")
    if exit_ is None:
        return
    if exit_ > limit:
        raise Unprocessable("Exit time cannot be in the future", code="FUTURE_TIME")
    if exit_ <= entry:
        raise Unprocessable("Exit time must be after entry time", code="EXIT_BEFORE_ENTRY")
    if ist_date(entry) != ist_date(exit_):
        raise Unprocessable("A session may not cross IST midnight", code="SESSION_CROSSES_MIDNIGHT")
    if exit_ - entry > _max_td():
        raise Unprocessable(
            f"A session cannot exceed {settings.MAX_SESSION_HOURS} hours",
            code="SESSION_TOO_LONG",
        )


async def ensure_no_overlap(
    employee: ObjectId,
    entry: dt.datetime,
    exit_: dt.datetime | None,
    exclude_id: ObjectId | None = None,
    session: Any = None,
) -> None:
    clash = await attendance_repo.find_overlap(employee, entry, exit_, exclude_id, session)
    if clash:
        raise Conflict(
            "Session overlaps an existing session",
            code="OVERLAPPING_SESSION",
            details={"session_id": str(clash["_id"])},
        )


async def get_session(session_id: str) -> dict:
    if not ObjectId.is_valid(session_id):
        raise NotFound("Attendance session not found", code="SESSION_NOT_FOUND")
    doc = await attendance_repo.get(ObjectId(session_id), is_deleted=False)
    if doc is None:
        raise NotFound("Attendance session not found", code="SESSION_NOT_FOUND")
    return doc


async def _auto_close(open_: dict) -> dict | None:
    """Close a forgotten session at its maximum duration and flag it."""
    entry = as_utc(open_["entry_time"])
    updated = await attendance_repo.update(
        {"_id": open_["_id"], "is_open": True},
        {
            "$set": {
                **session_fields(entry, entry + _max_td()),
                "auto_closed": True,
            }
        },
    )
    if updated:
        await log_audit(
            None,
            "attendance.auto_closed",
            "attendance",
            open_["_id"],
            before=open_,
            after=updated,
        )
    return updated


async def check_in(user: dict) -> dict:
    now = utcnow()
    open_session = await attendance_repo.find_open(user["_id"])
    if open_session:
        if now - as_utc(open_session["entry_time"]) <= _max_td():
            raise Conflict("You are already checked in", code="ALREADY_CHECKED_IN")
        await _auto_close(open_session)
    await ensure_no_overlap(user["_id"], now, None)
    doc = {
        "employee_id": user["_id"],
        "source": "live",
        "is_deleted": False,
        "version": 1,
        **session_fields(now, None),
    }
    try:
        return await attendance_repo.insert(doc)
    except DuplicateKeyError:
        raise Conflict("You are already checked in", code="ALREADY_CHECKED_IN") from None


async def check_out(user: dict) -> dict:
    open_session = await attendance_repo.find_open(user["_id"])
    if open_session is None:
        raise Conflict("You are not checked in", code="NOT_CHECKED_IN")
    entry, now = as_utc(open_session["entry_time"]), utcnow()
    cap = entry + _max_td()
    exit_time = max(min(now, cap), entry + timedelta(seconds=1))
    extra = {"auto_closed": True} if now > cap else {}
    updated = await attendance_repo.update(
        {"_id": open_session["_id"], "is_open": True},
        {"$set": {**session_fields(entry, exit_time), **extra}},
    )
    if updated is None:
        raise Conflict("You are not checked in", code="NOT_CHECKED_IN")
    return updated


async def current_session(user: dict) -> dict | None:
    return await attendance_repo.find_open(user["_id"])


async def list_sessions(
    employee: ObjectId | None, from_date: dt.date, to_date: dt.date, skip: int, limit: int
) -> tuple[list[dict], int]:
    if from_date > to_date:
        raise Unprocessable("from_date must not be after to_date", code="INVALID_RANGE")
    if (to_date - from_date).days + 1 > settings.REPORT_DAILY_MAX_DAYS:
        raise Unprocessable(
            f"Range cannot exceed {settings.REPORT_DAILY_MAX_DAYS} days",
            code="RANGE_TOO_LARGE",
        )
    filt: dict = {
        "is_deleted": False,
        "date": {"$gte": from_date.isoformat(), "$lte": to_date.isoformat()},
    }
    if employee:
        filt["employee_id"] = employee
        
    total = await attendance_repo.count(filt)
    rows = await attendance_repo.find(
        filt, sort=[("entry_time", -1)], skip=skip, limit=limit
    )
    
    # Enrich with employee names if fetching org-wide
    if not employee and rows:
        emp_ids = list({r["employee_id"] for r in rows})
        emps = await users_repo.find({"_id": {"$in": emp_ids}})
        emp_map = {e["_id"]: e for e in emps}
        for r in rows:
            r["_employee_data"] = emp_map.get(r["employee_id"])
            
    return rows, total


async def resolve_employee(ident: str) -> dict:
    user = await users_repo.resolve(ident)
    if user is None:
        raise NotFound("User not found", code="USER_NOT_FOUND")
    return user


async def add_manual_session(
    actor: dict, ident: str, entry: dt.datetime, exit_: dt.datetime, note: str | None = None
) -> dict:
    employee = await resolve_employee(ident)
    validate_times(entry, exit_)

    async def _tx(session):
        await ensure_no_overlap(employee["_id"], entry, exit_, session=session)
        doc = {
            "employee_id": employee["_id"],
            "source": "manual",
            "created_by": actor["_id"],
            "is_deleted": False,
            "version": 1,
            "note": note,
            **session_fields(entry, exit_),
        }
        created = await attendance_repo.insert(doc, session=session)
        await log_audit(
            actor["_id"],
            "attendance.created",
            "attendance",
            created["_id"],
            after=created,
            session=session,
        )
        return created

    return await run_txn(_tx)


async def update_session(
    actor: dict,
    session_id: str,
    entry: dt.datetime | None,
    exit_: dt.datetime | None,
    note: str | None = None,
) -> dict:
    current = await get_session(session_id)
    new_entry = entry or as_utc(current["entry_time"])
    new_exit = (
        exit_
        if exit_ is not None
        else (as_utc(current["exit_time"]) if current.get("exit_time") else None)
    )
    validate_times(new_entry, new_exit)

    async def _tx(session):
        await ensure_no_overlap(
            current["employee_id"], new_entry, new_exit, current["_id"], session
        )
        sets = {
            **session_fields(new_entry, new_exit),
            "edited_by": actor["_id"],
        }
        if note is not None:
            sets["note"] = note
        updated = await attendance_repo.update(
            {"_id": current["_id"], "is_deleted": False},
            {"$set": sets},
            session=session,
        )
        if updated is None:
            raise NotFound("Attendance session not found", code="SESSION_NOT_FOUND")
        await log_audit(
            actor["_id"],
            "attendance.updated",
            "attendance",
            current["_id"],
            before=current,
            after=updated,
            session=session,
        )
        return updated

    return await run_txn(_tx)


async def delete_session(actor: dict, session_id: str) -> None:
    """Soft delete and clear is_open to release the open-session unique index."""
    current = await get_session(session_id)

    async def _tx(session):
        updated = await attendance_repo.update(
            {"_id": current["_id"], "is_deleted": False},
            {
                "$set": {
                    "is_deleted": True,
                    "is_open": False,
                    "deleted_at": utcnow(),
                    "deleted_by": actor["_id"],
                }
            },
            session=session,
        )
        if updated is None:
            raise NotFound("Attendance session not found", code="SESSION_NOT_FOUND")
        await log_audit(
            actor["_id"],
            "attendance.deleted",
            "attendance",
            current["_id"],
            before=current,
            session=session,
        )

    await run_txn(_tx)
