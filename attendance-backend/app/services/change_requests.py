"""Attendance change-request workflow: employees ask, the admin approves or rejects."""
from __future__ import annotations

import datetime as dt
from typing import Any

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.core.errors import Conflict, NotFound, Unprocessable
from app.db.client import run_txn
from app.models.change_requests import ChangeRequestCreate
from app.repositories.attendance import attendance_repo
from app.repositories.change_requests import change_requests_repo
from app.repositories.users import users_repo
from app.services.attendance import (
    ensure_no_overlap,
    get_session,
    resolve_employee,
    session_fields,
    validate_times,
)
from app.services.audit import log_audit
from app.utils.timefmt import as_utc, utcnow

STATUSES = ("pending", "approved", "rejected", "cancelled")


def _merged_times(
    current: dict, proposed: dict
) -> tuple[dt.datetime, dt.datetime | None]:
    """Overlay proposed values on the current session's times."""
    entry = as_utc(proposed.get("entry_time") or current["entry_time"])
    exit_source = proposed.get("exit_time") or current.get("exit_time")
    return entry, as_utc(exit_source) if exit_source else None


async def get_request(request_id: str) -> dict:
    if not ObjectId.is_valid(request_id):
        raise NotFound("Change request not found", code="REQUEST_NOT_FOUND")
    doc = await change_requests_repo.get(ObjectId(request_id))
    if doc is None:
        raise NotFound("Change request not found", code="REQUEST_NOT_FOUND")
    return doc


async def get_request_for(user: dict, request_id: str) -> dict:
    """Admins see any request; other users only see their own."""
    doc = await get_request(request_id)
    if user.get("role") != "admin" and doc["requester_id"] != user["_id"]:
        raise NotFound("Change request not found", code="REQUEST_NOT_FOUND")
    return doc


async def create_request(user: dict, data: ChangeRequestCreate) -> dict:
    request_id = ObjectId()
    session_id: ObjectId | None = None
    original: dict | None = None
    proposed: dict = {}

    if data.action == "add":
        validate_times(data.entry_time, data.exit_time)
        await ensure_no_overlap(user["_id"], data.entry_time, data.exit_time)
        proposed = {"entry_time": data.entry_time, "exit_time": data.exit_time}
        target_id = request_id
    else:
        current = await get_session(data.session_id or "")
        if current["employee_id"] != user["_id"]:
            raise NotFound("Attendance session not found", code="SESSION_NOT_FOUND")
        session_id = target_id = current["_id"]
        original = {
            "entry_time": current["entry_time"],
            "exit_time": current.get("exit_time"),
        }
        if data.action == "edit":
            proposed = {
                key: value
                for key, value in (
                    ("entry_time", data.entry_time),
                    ("exit_time", data.exit_time),
                )
                if value is not None
            }
            new_entry, new_exit = _merged_times(current, proposed)
            validate_times(new_entry, new_exit)
            await ensure_no_overlap(
                user["_id"], new_entry, new_exit, current["_id"]
            )

    doc = {
        "_id": request_id,
        "requester_id": user["_id"],
        "action": data.action,
        "target": {"type": "attendance", "id": target_id},
        "session_id": session_id,
        "proposed": proposed or None,
        "original": original,
        "reason": data.reason,
        "status": "pending",
        "version": 1,
    }

    async def _tx(session):
        created = await change_requests_repo.insert(doc, session=session)
        await log_audit(
            user["_id"],
            "change_request.created",
            "change_request",
            created["_id"],
            after=created,
            session=session,
        )
        return created

    try:
        return await run_txn(_tx)
    except DuplicateKeyError:
        raise Conflict(
            "A pending request already exists for this session",
            code="PENDING_REQUEST_EXISTS",
        ) from None


async def _apply(actor: dict, request: dict, session: Any) -> None:
    """Apply an approved request inside the approval transaction."""
    proposed = request.get("proposed") or {}
    audit_meta = {"request_id": str(request["_id"])}

    if request["action"] == "add":
        entry, exit_time = (
            as_utc(proposed["entry_time"]),
            as_utc(proposed["exit_time"]),
        )
        validate_times(entry, exit_time)
        await ensure_no_overlap(
            request["requester_id"], entry, exit_time, session=session
        )
        doc = {
            "employee_id": request["requester_id"],
            "source": "change_request",
            "request_id": request["_id"],
            "created_by": actor["_id"],
            "is_deleted": False,
            "version": 1,
            **session_fields(entry, exit_time),
        }
        created = await attendance_repo.insert(doc, session=session)
        await log_audit(
            actor["_id"],
            "attendance.created",
            "attendance",
            created["_id"],
            after=created,
            meta=audit_meta,
            session=session,
        )
        return

    current = await attendance_repo.get(
        request["session_id"], session=session, is_deleted=False
    )
    if current is None:
        raise Unprocessable(
            "The target session no longer exists", code="SESSION_GONE"
        )

    if request["action"] == "edit":
        new_entry, new_exit = _merged_times(current, proposed)
        validate_times(new_entry, new_exit)
        await ensure_no_overlap(
            current["employee_id"],
            new_entry,
            new_exit,
            current["_id"],
            session,
        )
        updated = await attendance_repo.update(
            {"_id": current["_id"], "is_deleted": False},
            {
                "$set": {
                    **session_fields(new_entry, new_exit),
                    "edited_by": actor["_id"],
                }
            },
            session=session,
        )
        if updated is None:
            raise Unprocessable(
                "The target session no longer exists", code="SESSION_GONE"
            )
        await log_audit(
            actor["_id"],
            "attendance.updated",
            "attendance",
            current["_id"],
            before=current,
            after=updated,
            meta=audit_meta,
            session=session,
        )
        return

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
        raise Unprocessable(
            "The target session no longer exists", code="SESSION_GONE"
        )
    await log_audit(
        actor["_id"],
        "attendance.deleted",
        "attendance",
        current["_id"],
        before=current,
        meta=audit_meta,
        session=session,
    )


async def _claim(
    request: dict,
    status: str,
    decider: dict,
    note: str | None,
    session: Any,
) -> dict:
    claimed = await change_requests_repo.update(
        {"_id": request["_id"], "status": "pending"},
        {
            "$set": {
                "status": status,
                "decided_by": decider["_id"],
                "decided_at": utcnow(),
                "decision_note": note,
            }
        },
        session=session,
    )
    if claimed is None:
        raise Conflict("This request is no longer pending", code="REQUEST_NOT_PENDING")
    return claimed


async def approve(actor: dict, request_id: str, note: str | None) -> dict:
    request = await get_request(request_id)
    if request["status"] != "pending":
        raise Conflict("This request is no longer pending", code="REQUEST_NOT_PENDING")

    async def _tx(session):
        claimed = await _claim(request, "approved", actor, note, session)
        await _apply(actor, claimed, session)
        await log_audit(
            actor["_id"],
            "change_request.approved",
            "change_request",
            request["_id"],
            before=request,
            after=claimed,
            session=session,
        )
        return claimed

    return await run_txn(_tx)


async def reject(actor: dict, request_id: str, note: str) -> dict:
    request = await get_request(request_id)
    if request["status"] != "pending":
        raise Conflict("This request is no longer pending", code="REQUEST_NOT_PENDING")

    async def _tx(session):
        claimed = await _claim(request, "rejected", actor, note, session)
        await log_audit(
            actor["_id"],
            "change_request.rejected",
            "change_request",
            request["_id"],
            before=request,
            after=claimed,
            session=session,
        )
        return claimed

    return await run_txn(_tx)


async def cancel(user: dict, request_id: str) -> dict:
    """Allow requesters to withdraw their own pending requests."""
    request = await get_request(request_id)
    if request["requester_id"] != user["_id"]:
        raise NotFound("Change request not found", code="REQUEST_NOT_FOUND")
    if request["status"] != "pending":
        raise Conflict("This request is no longer pending", code="REQUEST_NOT_PENDING")

    async def _tx(session):
        claimed = await _claim(request, "cancelled", user, None, session)
        await log_audit(
            user["_id"],
            "change_request.cancelled",
            "change_request",
            request["_id"],
            before=request,
            after=claimed,
            session=session,
        )
        return claimed

    return await run_txn(_tx)


async def list_requests(
    *,
    requester_id: ObjectId | None = None,
    employee: str | None = None,
    status: str | None = None,
    skip: int,
    limit: int,
) -> tuple[list[dict], int]:
    filt: dict = {}
    if requester_id is not None:
        filt["requester_id"] = requester_id
    elif employee:
        filt["requester_id"] = (await resolve_employee(employee))["_id"]
    if status:
        if status not in STATUSES:
            raise Unprocessable(
                f"status must be one of: {', '.join(STATUSES)}",
                code="INVALID_STATUS",
            )
        filt["status"] = status
    total = await change_requests_repo.count(filt)
    rows = await change_requests_repo.find(
        filt, sort=[("created_at", -1)], skip=skip, limit=limit
    )
    return rows, total


async def attach_requesters(rows: list[dict]) -> list[dict]:
    """Add each requester's employee code and display name."""
    users = await users_repo.many_by_ids(
        [row["requester_id"] for row in rows],
        projection={"employee_id": 1, "personal.full_name": 1},
    )
    enriched = []
    for row in rows:
        user = users.get(row["requester_id"]) or {}
        enriched.append(
            {
                **row,
                "requester": {
                    "employee_id": user.get("employee_id"),
                    "full_name": (user.get("personal") or {}).get("full_name"),
                },
            }
        )
    return enriched
