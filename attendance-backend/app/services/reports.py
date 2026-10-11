"""Read-only attendance reports built using the shared weekly policy."""
from __future__ import annotations

import datetime as dt
from typing import Any

from bson import ObjectId

from app.config import settings
from app.core.errors import Unprocessable
from app.db.client import aggregate
from app.repositories.attendance import attendance_repo
from app.repositories.users import users_repo
from app.services.holidays import holiday_dates
from app.services.policy import evaluate_week, is_attended
from app.utils.timefmt import ist_today, utcnow
from app.utils.weeks import (
    daterange,
    day_type,
    week_end_of,
    week_starts_between,
)

_EMPTY = {"minutes": 0, "sessions": 0, "open": False}


def _who(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "employee_id": user.get("employee_id"),
        "full_name": (user.get("personal") or {}).get("full_name"),
    }


def _hours(minutes: int) -> float:
    return round(minutes / 60, 2)


def _joining(user: dict) -> dt.date | None:
    raw = (user.get("professional") or {}).get("joining_date")
    try:
        return dt.date.fromisoformat(raw) if raw else None
    except ValueError:
        return None


def _check_range(start: dt.date, end: dt.date, max_days: int) -> None:
    if start > end:
        raise Unprocessable("from_date must not be after to_date", code="INVALID_RANGE")
    if (end - start).days + 1 > max_days:
        raise Unprocessable(
            f"Range cannot exceed {max_days} days", code="RANGE_TOO_LARGE"
        )


def _minutes_expr(now: dt.datetime) -> dict:
    """Count closed duration, or live open-session duration capped at the max."""
    live = {
        "$max": [
            0,
            {
                "$min": [
                    settings.MAX_SESSION_HOURS * 60,
                    {
                        "$floor": {
                            "$divide": [
                                {"$subtract": [now, "$entry_time"]},
                                60000,
                            ]
                        }
                    },
                ]
            },
        ]
    }
    return {
        "$cond": [
            {"$eq": ["$is_open", True]},
            live,
            {"$ifNull": ["$duration_minutes", 0]},
        ]
    }


async def _day_stats(
    employee_ids: list[ObjectId],
    start: dt.date,
    end: dt.date,
    now: dt.datetime,
) -> dict[ObjectId, dict[dt.date, dict[str, Any]]]:
    """Return per-employee, per-day minutes/session counts for the requested dates."""
    if not employee_ids:
        return {}
    rows = await aggregate(
        attendance_repo.col,
        [
            {
                "$match": {
                    "employee_id": {"$in": employee_ids},
                    "is_deleted": False,
                    "date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
                }
            },
            {
                "$group": {
                    "_id": {"e": "$employee_id", "d": "$date"},
                    "minutes": {"$sum": _minutes_expr(now)},
                    "sessions": {"$sum": 1},
                    "open": {
                        "$max": {
                            "$cond": [{"$eq": ["$is_open", True]}, 1, 0]
                        }
                    },
                }
            },
        ],
    )
    out: dict[ObjectId, dict[dt.date, dict[str, Any]]] = {}
    for row in rows:
        day = dt.date.fromisoformat(row["_id"]["d"])
        out.setdefault(row["_id"]["e"], {})[day] = {
            "minutes": int(row["minutes"]),
            "sessions": int(row["sessions"]),
            "open": bool(row["open"]),
        }
    return out


async def daily_report(employee: dict, start: dt.date, end: dt.date) -> dict:
    """Return one record per calendar day, including days without attendance."""
    _check_range(start, end, settings.REPORT_DAILY_MAX_DAYS)
    stats = (
        await _day_stats([employee["_id"]], start, end, utcnow())
    ).get(employee["_id"], {})
    holidays = await holiday_dates(start, end)
    offs = settings.weekly_off_set
    days: list[dict] = []
    totals = {
        "working_days": 0,
        "holidays": 0,
        "weekly_off_days": 0,
        "attended_working_days": 0,
        "working_minutes": 0,
        "extra_minutes": 0,
    }
    for day in daterange(start, end):
        kind = day_type(day, holidays, offs)
        stat = stats.get(day, _EMPTY)
        minutes = stat["minutes"]
        attended = is_attended(minutes)
        if kind == "working":
            totals["working_days"] += 1
            totals["working_minutes"] += minutes
            totals["attended_working_days"] += int(attended)
        else:
            totals["holidays" if kind == "holiday" else "weekly_off_days"] += 1
            totals["extra_minutes"] += minutes
        days.append(
            {
                "date": day.isoformat(),
                "weekday": day.strftime("%A"),
                "day_type": kind,
                "minutes": minutes,
                "hours": _hours(minutes),
                "sessions": stat["sessions"],
                "attended": attended,
                "has_open_session": stat["open"],
            }
        )
    totals["working_hours"] = _hours(totals["working_minutes"])
    totals["extra_hours"] = _hours(totals["extra_minutes"])
    return {
        "employee": _who(employee),
        "from_date": start.isoformat(),
        "to_date": end.isoformat(),
        "days": days,
        "totals": totals,
    }


async def week_results(
    week_start: dt.date,
    employees: list[dict],
    *,
    include_days: bool = False,
) -> list[dict]:
    """Evaluate each employee for a single week; shared with scheduled jobs."""
    if not employees:
        return []
    end = week_end_of(week_start)
    stats = await _day_stats(
        [employee["_id"] for employee in employees], week_start, end, utcnow()
    )
    holidays = await holiday_dates(week_start, end)
    today = ist_today()
    results = []
    for employee in employees:
        minutes = {
            day: stat["minutes"]
            for day, stat in stats.get(employee["_id"], {}).items()
        }
        result = evaluate_week(
            week_start, minutes, holidays, include_days=include_days
        )
        joined = _joining(employee)
        result["applicable"] = joined is None or end >= joined
        result["complete"] = end < today
        if not result["applicable"]:
            result["compliant"] = None
        result["employee"] = _who(employee)
        results.append(result)
    return results


async def weekly_report(employee: dict, start: dt.date, end: dt.date) -> dict:
    """Return policy results for all Monday-to-Sunday weeks overlapping the range."""
    _check_range(start, end, settings.REPORT_MAX_DAYS)
    weeks = week_starts_between(start, end)
    first, last = weeks[0], week_end_of(weeks[-1])
    stats = (
        await _day_stats([employee["_id"]], first, last, utcnow())
    ).get(employee["_id"], {})
    holidays = await holiday_dates(first, last)
    minutes = {day: stat["minutes"] for day, stat in stats.items()}
    joined, today = _joining(employee), ist_today()
    items = []
    for week_start in weeks:
        result = evaluate_week(week_start, minutes, holidays)
        result["applicable"] = joined is None or week_end_of(week_start) >= joined
        result["complete"] = week_end_of(week_start) < today
        if not result["applicable"]:
            result["compliant"] = None
        items.append(result)
    applicable = [
        item for item in items if item["applicable"] and item["complete"]
    ]
    return {
        "employee": _who(employee),
        "from_date": start.isoformat(),
        "to_date": end.isoformat(),
        "weeks": items,
        "summary": {
            "completed_weeks": len(applicable),
            "compliant_weeks": sum(
                1 for item in applicable if item["compliant"]
            ),
            "non_compliant_weeks": sum(
                1 for item in applicable if not item["compliant"]
            ),
        },
    }


async def list_active_employees(
    week_start: dt.date,
    team_id: str | None = None,
    skip: int = 0,
    limit: int = 0,
) -> tuple[list[dict], int]:
    """List active employees (not admins) who joined by the week end."""
    filt: dict = {
        "role": "employee",
        "status": "active",
        "is_deleted": {"$ne": True},
        "professional.joining_date": {
            "$lte": week_end_of(week_start).isoformat()
        },
    }
    if team_id:
        if not ObjectId.is_valid(team_id):
            raise Unprocessable("Invalid team id", code="INVALID_TEAM")
        filt["professional.team_ids"] = ObjectId(team_id)
    total = await users_repo.count(filt)
    rows = await users_repo.find(
        filt, sort=[("employee_id", 1)], skip=skip, limit=limit
    )
    return rows, total


async def weekly_overview(
    week_start: dt.date, team_id: str | None, skip: int, limit: int
) -> tuple[list[dict], int]:
    employees, total = await list_active_employees(
        week_start, team_id, skip, limit
    )
    return await week_results(week_start, employees), total

# --- Enterprise BI Analytics ---

async def bi_summary(start: dt.date, end: dt.date, team_id: str | None = None) -> dict:
    _check_range(start, end, settings.REPORT_MAX_DAYS)
    # Use end date to catch anyone joining within the period
    employees, _ = await list_active_employees(end, team_id, limit=0)
    emp_ids = [e["_id"] for e in employees]
    stats = await _day_stats(emp_ids, start, end, utcnow())
    holidays = await holiday_dates(start, end)
    offs = settings.weekly_off_set
    
    total_expected = 0
    total_present = 0
    total_minutes = 0
    total_open = 0
    
    dates = list(daterange(start, end))
    working_dates = [d for d in dates if day_type(d, holidays, offs) == "working"]
    
    for emp in employees:
        joined = _joining(emp)
        emp_stats = stats.get(emp["_id"], {})
        for day in working_dates:
            if joined and day < joined:
                continue
            total_expected += 1
            stat = emp_stats.get(day, _EMPTY)
            if is_attended(stat["minutes"]):
                total_present += 1
            total_minutes += stat["minutes"]
            if stat["open"]:
                total_open += 1
                
    rate = (total_present / total_expected * 100) if total_expected > 0 else 0
    
    return {
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "kpis": {
            "active_employees": len(employees),
            "expected_days": total_expected,
            "present_days": total_present,
            "absent_days": total_expected - total_present,
            "attendance_rate": round(rate, 2),
            "average_worked_hours": _hours(total_minutes / total_expected) if total_expected > 0 else 0,
            "total_worked_hours": _hours(total_minutes),
            "open_sessions": total_open
        }
    }

async def bi_trends(start: dt.date, end: dt.date, team_id: str | None = None) -> list[dict]:
    _check_range(start, end, settings.REPORT_MAX_DAYS)
    employees, _ = await list_active_employees(end, team_id, limit=0)
    emp_ids = [e["_id"] for e in employees]
    stats = await _day_stats(emp_ids, start, end, utcnow())
    holidays = await holiday_dates(start, end)
    offs = settings.weekly_off_set
    
    trends = []
    for day in daterange(start, end):
        kind = day_type(day, holidays, offs)
        if kind != "working":
            continue
        expected = 0
        present = 0
        for emp in employees:
            joined = _joining(emp)
            if joined and day < joined:
                continue
            expected += 1
            stat = stats.get(emp["_id"], {}).get(day, _EMPTY)
            if is_attended(stat["minutes"]):
                present += 1
        rate = (present / expected * 100) if expected > 0 else 0
        trends.append({
            "date": day.isoformat(),
            "expected": expected,
            "present": present,
            "absent": expected - present,
            "rate": round(rate, 2)
        })
    return trends

async def bi_teams(start: dt.date, end: dt.date) -> list[dict]:
    _check_range(start, end, settings.REPORT_MAX_DAYS)
    from app.repositories.teams import teams_repo
    teams = await teams_repo.find({"is_deleted": {"$ne": True}})
    
    results = []
    for t in teams:
        summary = await bi_summary(start, end, str(t["_id"]))
        kpis = summary["kpis"]
        results.append({
            "team": {"id": str(t["_id"]), "name": t["name"]},
            "size": kpis["active_employees"],
            "expected_days": kpis["expected_days"],
            "present_days": kpis["present_days"],
            "attendance_rate": kpis["attendance_rate"],
            "average_worked_hours": kpis["average_worked_hours"]
        })
    results.sort(key=lambda x: x["attendance_rate"], reverse=True)
    return results

async def bi_exceptions(start: dt.date, end: dt.date, skip: int=0, limit: int=50) -> dict:
    _check_range(start, end, settings.REPORT_MAX_DAYS)
    # Exceptional cases: Open session from previous days, duration > 16 hours
    today_str = ist_today().isoformat()
    rows = await attendance_repo.find({
        "is_deleted": False,
        "date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        "$or": [
            {"exit_time": None, "date": {"$ne": today_str}},
            {"duration_minutes": {"$gt": settings.MAX_SESSION_HOURS * 60}}
        ]
    }, skip=skip, limit=limit, sort=[("date", -1)])
    
    total = await attendance_repo.count({
        "is_deleted": False,
        "date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        "$or": [
            {"exit_time": None, "date": {"$ne": today_str}},
            {"duration_minutes": {"$gt": settings.MAX_SESSION_HOURS * 60}}
        ]
    })
    
    exceptions = []
    for r in rows:
        reason = "Missing Check-out" if r.get("exit_time") is None else "Unusually long duration"
        severity = "high" if "Missing" in reason else "medium"
        exceptions.append({
            "id": str(r["_id"]),
            "employee_id": str(r["employee_id"]),
            "date": r["date"],
            "entry_time": r["entry_time"].replace(tzinfo=dt.UTC).isoformat().replace("+00:00", "Z"),
            "exit_time": r["exit_time"].replace(tzinfo=dt.UTC).isoformat().replace("+00:00", "Z") if r.get("exit_time") else None,
            "type": reason,
            "severity": severity,
            "duration_minutes": r.get("duration_minutes", 0)
        })
    
    # Enrich with employee names
    emp_ids = list({ObjectId(e["employee_id"]) for e in exceptions})
    if emp_ids:
        emps = await users_repo.find({"_id": {"$in": emp_ids}})
        emp_map = {str(e["_id"]): _who(e) for e in emps}
        for ex in exceptions:
            ex["employee"] = emp_map.get(ex["employee_id"])
            
    return {"items": exceptions, "meta": {"total": total, "skip": skip, "limit": limit}}
