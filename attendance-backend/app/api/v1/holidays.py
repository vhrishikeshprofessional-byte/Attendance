"""Holiday endpoints. Any signed-in user can read; only the admin can change."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Query

from app.api.deps import AdminUser, CurrentUser
from app.models.auth import MessageOut
from app.models.holidays import HolidayCreate, HolidayUpdate
from app.services import holidays as svc
from app.utils.serialize import doc_out

router = APIRouter(prefix="/holidays", tags=["holidays"])


@router.post("", status_code=201)
async def create_holiday(body: HolidayCreate, admin: AdminUser):
    return doc_out(await svc.create_holiday(admin, body))


@router.get("")
async def list_holidays(
    user: CurrentUser,
    year: int | None = Query(None, ge=2000, le=2100),
    from_date: dt.date | None = Query(None),
    to_date: dt.date | None = Query(None),
):
    rows = await svc.list_holidays(year, from_date, to_date)
    return {"items": [doc_out(row) for row in rows]}


@router.get("/{holiday_id}")
async def get_holiday(holiday_id: str, user: CurrentUser):
    return doc_out(await svc.get_holiday(holiday_id))


@router.patch("/{holiday_id}")
async def update_holiday(holiday_id: str, body: HolidayUpdate, admin: AdminUser):
    return doc_out(await svc.update_holiday(admin, holiday_id, body))


@router.delete("/{holiday_id}", response_model=MessageOut)
async def delete_holiday(holiday_id: str, admin: AdminUser):
    await svc.delete_holiday(admin, holiday_id)
    return {"message": "Holiday deleted"}
