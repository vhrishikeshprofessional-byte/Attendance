"""Holiday calendar use-cases. Dates are stored as ISO strings (YYYY-MM-DD)."""
from __future__ import annotations

import datetime as dt

from bson import ObjectId

from app.config import settings
from app.core.errors import Conflict, NotFound, Unprocessable
from app.db.client import run_txn
from app.models.holidays import HolidayCreate, HolidayUpdate
from app.repositories.holidays import holidays_repo
from app.services.audit import log_audit
from app.utils.timefmt import ist_today


async def get_holiday(holiday_id: str) -> dict:
    if not ObjectId.is_valid(holiday_id):
        raise NotFound("Holiday not found", code="HOLIDAY_NOT_FOUND")
    doc = await holidays_repo.get(ObjectId(holiday_id))
    if doc is None:
        raise NotFound("Holiday not found", code="HOLIDAY_NOT_FOUND")
    return doc


async def _ensure_date_free(iso: str, exclude_id: ObjectId | None = None) -> None:
    filt: dict = {"date": iso}
    if exclude_id is not None:
        filt["_id"] = {"$ne": exclude_id}
    if await holidays_repo.find_one(filt):
        raise Conflict("A holiday already exists on this date", code="HOLIDAY_DATE_TAKEN")


async def create_holiday(actor: dict, data: HolidayCreate) -> dict:
    iso = data.date.isoformat()
    await _ensure_date_free(iso)
    doc = {"date": iso, "name": " ".join(data.name.split()), "version": 1}

    async def _tx(session):
        created = await holidays_repo.insert(doc, session=session)
        await log_audit(
            actor["_id"],
            "holiday.created",
            "holiday",
            created["_id"],
            after=created,
            session=session,
        )
        return created

    return await run_txn(_tx)


async def list_holidays(
    year: int | None, from_date: dt.date | None, to_date: dt.date | None
) -> list[dict]:
    if from_date or to_date:
        if not (from_date and to_date):
            raise Unprocessable("Provide both from_date and to_date", code="INVALID_RANGE")
        start, end = from_date, to_date
    else:
        selected_year = year or ist_today().year
        start, end = dt.date(selected_year, 1, 1), dt.date(selected_year, 12, 31)
    if start > end:
        raise Unprocessable("from_date must not be after to_date", code="INVALID_RANGE")
    if (end - start).days + 1 > settings.REPORT_MAX_DAYS:
        raise Unprocessable(
            f"Range cannot exceed {settings.REPORT_MAX_DAYS} days", code="RANGE_TOO_LARGE"
        )
    return await holidays_repo.find(
        {"date": {"$gte": start.isoformat(), "$lte": end.isoformat()}}, sort=[("date", 1)]
    )


async def holiday_dates(
    start: dt.date, end: dt.date, session=None
) -> set[dt.date]:
    """Return holiday dates in the inclusive range [start, end]."""
    rows = await holidays_repo.find(
        {"date": {"$gte": start.isoformat(), "$lte": end.isoformat()}},
        projection={"date": 1},
        session=session,
    )
    return {dt.date.fromisoformat(row["date"]) for row in rows}


async def update_holiday(actor: dict, holiday_id: str, data: HolidayUpdate) -> dict:
    holiday = await get_holiday(holiday_id)
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise Unprocessable("No fields to update", code="NO_CHANGES")
    sets: dict = {}
    if "date" in changes:
        if changes["date"] is None:
            raise Unprocessable(
                "date cannot be null", code="INVALID_FIELD", details={"field": "date"}
            )
        iso = changes["date"].isoformat()
        await _ensure_date_free(iso, exclude_id=holiday["_id"])
        sets["date"] = iso
    if "name" in changes:
        if changes["name"] is None:
            raise Unprocessable(
                "name cannot be null", code="INVALID_FIELD", details={"field": "name"}
            )
        sets["name"] = " ".join(changes["name"].split())

    async def _tx(session):
        updated = await holidays_repo.update(
            {"_id": holiday["_id"]}, {"$set": sets}, session=session
        )
        if updated is None:
            raise NotFound("Holiday not found", code="HOLIDAY_NOT_FOUND")
        await log_audit(
            actor["_id"],
            "holiday.updated",
            "holiday",
            holiday["_id"],
            before=holiday,
            after=updated,
            session=session,
        )
        return updated

    return await run_txn(_tx)


async def delete_holiday(actor: dict, holiday_id: str) -> None:
    """Hard delete: the unique date index has no soft-delete filter."""
    holiday = await get_holiday(holiday_id)

    async def _tx(session):
        if await holidays_repo.delete_one({"_id": holiday["_id"]}, session=session) != 1:
            raise NotFound("Holiday not found", code="HOLIDAY_NOT_FOUND")
        await log_audit(
            actor["_id"],
            "holiday.deleted",
            "holiday",
            holiday["_id"],
            before=holiday,
            session=session,
        )

    await run_txn(_tx)
