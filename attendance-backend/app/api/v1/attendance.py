"""Attendance endpoints."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Query

from app.api.deps import AdminUser, CurrentUser
from app.models.attendance import ManualSessionIn, SessionUpdateIn
from app.models.auth import MessageOut
from app.services import attendance as svc
from app.utils.pagination import Page, page_meta
from app.utils.serialize import doc_out
from app.utils.timefmt import dt_fields, ist_today

router = APIRouter(prefix="/attendance", tags=["attendance"])


def _out(doc: dict) -> dict:
    out = doc_out(doc)
    out.update(dt_fields("entry_time", doc["entry_time"]))
    out.update(dt_fields("exit_time", doc.get("exit_time")))
    if doc.get("_employee_data"):
        e = doc["_employee_data"]
        out["employee"] = {
            "id": str(e["_id"]),
            "employee_id": e.get("employee_id"),
            "full_name": (e.get("personal") or {}).get("full_name")
        }
    return out


def _range(
    from_date: dt.date | None, to_date: dt.date | None
) -> tuple[dt.date, dt.date]:
    end = to_date or ist_today()
    return (from_date or end - dt.timedelta(days=29)), end


@router.post("/check-in", status_code=201)
async def check_in(user: CurrentUser):
    return _out(await svc.check_in(user))


@router.post("/check-out")
async def check_out(user: CurrentUser):
    return _out(await svc.check_out(user))


@router.get("/status")
async def status(user: CurrentUser):
    open_session = await svc.current_session(user)
    return {
        "checked_in": open_session is not None,
        "session": _out(open_session) if open_session else None,
    }


@router.get("/me")
async def my_sessions(
    user: CurrentUser,
    page: Page = Depends(),
    from_date: dt.date | None = Query(None),
    to_date: dt.date | None = Query(None),
):
    start, end = _range(from_date, to_date)
    rows, total = await svc.list_sessions(
        user["_id"], start, end, page.skip, page.page_size
    )
    return {"items": [_out(row) for row in rows], "meta": page_meta(page, total)}


@router.get("")
async def employee_sessions(
    admin: AdminUser,
    employee: str | None = Query(None, max_length=64),
    page: Page = Depends(),
    from_date: dt.date | None = Query(None),
    to_date: dt.date | None = Query(None),
):
    target_id = None
    if employee:
        target = await svc.resolve_employee(employee)
        target_id = target["_id"]
        
    start, end = _range(from_date, to_date)
    rows, total = await svc.list_sessions(
        target_id, start, end, page.skip, page.page_size
    )
    return {"items": [_out(row) for row in rows], "meta": page_meta(page, total)}


@router.post("/manual", status_code=201)
async def add_manual(body: ManualSessionIn, admin: AdminUser):
    return _out(
        await svc.add_manual_session(
            admin, body.employee, body.entry_time, body.exit_time, body.note
        )
    )


@router.patch("/{session_id}")
async def update_session(
    session_id: str, body: SessionUpdateIn, admin: AdminUser
):
    return _out(
        await svc.update_session(
            admin, session_id, body.entry_time, body.exit_time, body.note
        )
    )


@router.delete("/{session_id}", response_model=MessageOut)
async def delete_session(session_id: str, admin: AdminUser):
    await svc.delete_session(admin, session_id)
    return {"message": "Attendance session deleted"}
