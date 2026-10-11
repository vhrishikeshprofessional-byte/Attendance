"""Reports. Employees read their own; admins can read others and the overview."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Query

from app.api.deps import AdminUser, CurrentUser
from app.services import reports as svc
from app.services.attendance import resolve_employee
from app.utils.pagination import Page, page_meta
from app.utils.timefmt import ist_today
from app.utils.weeks import week_start_of

router = APIRouter(prefix="/reports", tags=["reports"])


def _daily_range(
    from_date: dt.date | None, to_date: dt.date | None
) -> tuple[dt.date, dt.date]:
    end = to_date or ist_today()
    return from_date or end - dt.timedelta(days=29), end


def _weekly_range(
    from_date: dt.date | None, to_date: dt.date | None
) -> tuple[dt.date, dt.date]:
    end = to_date or ist_today()
    return from_date or week_start_of(end) - dt.timedelta(days=49), end


@router.get("/me/daily")
async def my_daily(
    user: CurrentUser,
    from_date: dt.date | None = Query(None),
    to_date: dt.date | None = Query(None),
):
    start, end = _daily_range(from_date, to_date)
    return await svc.daily_report(user, start, end)


@router.get("/me/weekly")
async def my_weekly(
    user: CurrentUser,
    from_date: dt.date | None = Query(None),
    to_date: dt.date | None = Query(None),
):
    start, end = _weekly_range(from_date, to_date)
    return await svc.weekly_report(user, start, end)


@router.get("/daily")
async def employee_daily(
    admin: AdminUser,
    employee: str = Query(min_length=1, max_length=64),
    from_date: dt.date | None = Query(None),
    to_date: dt.date | None = Query(None),
):
    target = await resolve_employee(employee)
    start, end = _daily_range(from_date, to_date)
    return await svc.daily_report(target, start, end)


@router.get("/weekly")
async def employee_weekly(
    admin: AdminUser,
    employee: str = Query(min_length=1, max_length=64),
    from_date: dt.date | None = Query(None),
    to_date: dt.date | None = Query(None),
):
    target = await resolve_employee(employee)
    start, end = _weekly_range(from_date, to_date)
    return await svc.weekly_report(target, start, end)


@router.get("/weekly-overview")
async def weekly_overview(
    admin: AdminUser,
    page: Page = Depends(),
    week_start: dt.date | None = Query(None),
    team_id: str | None = Query(None),
):
    start = week_start_of(week_start or ist_today())
    rows, total = await svc.weekly_overview(
        start, team_id, page.skip, page.page_size
    )
    return {
        "week_start": start.isoformat(),
        "items": rows,
        "meta": page_meta(page, total),
    }

# --- Enterprise BI Endpoints ---

@router.get("/bi/summary")
async def get_bi_summary(
    admin: AdminUser,
    from_date: dt.date | None = Query(None),
    to_date: dt.date | None = Query(None),
    team_id: str | None = Query(None),
):
    start, end = _daily_range(from_date, to_date)
    return await svc.bi_summary(start, end, team_id)

@router.get("/bi/trends")
async def get_bi_trends(
    admin: AdminUser,
    from_date: dt.date | None = Query(None),
    to_date: dt.date | None = Query(None),
    team_id: str | None = Query(None),
):
    start, end = _daily_range(from_date, to_date)
    return await svc.bi_trends(start, end, team_id)

@router.get("/bi/teams")
async def get_bi_teams(
    admin: AdminUser,
    from_date: dt.date | None = Query(None),
    to_date: dt.date | None = Query(None),
):
    start, end = _daily_range(from_date, to_date)
    return await svc.bi_teams(start, end)

@router.get("/bi/exceptions")
async def get_bi_exceptions(
    admin: AdminUser,
    page: Page = Depends(),
    from_date: dt.date | None = Query(None),
    to_date: dt.date | None = Query(None),
):
    start, end = _daily_range(from_date, to_date)
    return await svc.bi_exceptions(start, end, page.skip, page.page_size)
