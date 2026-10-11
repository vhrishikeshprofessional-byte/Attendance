"""Pure weekly attendance policy shared by reports, jobs, and tests."""
from __future__ import annotations

from collections.abc import Mapping
from datetime import date

from app.config import settings
from app.utils.weeks import (
    daterange,
    day_type,
    holidays_on_working_days,
    week_end_of,
)


def is_attended(minutes: int) -> bool:
    """A day is attended once it reaches the configured minimum duration."""
    return minutes > 0 and minutes >= settings.MIN_ATTENDED_DAY_MINUTES


def required_days(
    week_start: date,
    holidays: set[date],
    offs: frozenset[int] | None = None,
) -> int:
    """Reduce the weekly target for each holiday on a working day."""
    offs = settings.weekly_off_set if offs is None else offs
    base = min(settings.REQUIRED_DAYS, 7 - len(offs))
    return max(0, base - holidays_on_working_days(week_start, holidays, offs))


def evaluate_week(
    week_start: date,
    minutes_by_day: Mapping[date, int],
    holidays: set[date],
    offs: frozenset[int] | None = None,
    include_days: bool = True,
) -> dict:
    """Evaluate compliance for one Monday-through-Sunday week."""
    offs = settings.weekly_off_set if offs is None else offs
    req_days = required_days(week_start, holidays, offs)
    req_minutes = req_days * settings.REQUIRED_HOURS_PER_DAY * 60
    attended_days = counted_minutes = extra_minutes = 0
    days: list[dict] = []

    for day in daterange(week_start, week_end_of(week_start)):
        kind = day_type(day, holidays, offs)
        minutes = int(minutes_by_day.get(day, 0))
        attended = is_attended(minutes)
        if kind == "working":
            if attended:
                attended_days += 1
                counted_minutes += minutes
        else:
            extra_minutes += minutes
        days.append(
            {
                "date": day.isoformat(),
                "day_type": kind,
                "minutes": minutes,
                "attended": attended,
            }
        )

    result = {
        "week_start": week_start.isoformat(),
        "week_end": week_end_of(week_start).isoformat(),
        "required_days": req_days,
        "required_minutes": req_minutes,
        "holidays_on_working_days": holidays_on_working_days(
            week_start, holidays, offs
        ),
        "attended_days": attended_days,
        "counted_minutes": counted_minutes,
        "extra_minutes": extra_minutes,
        "shortfall_days": max(0, req_days - attended_days),
        "shortfall_minutes": max(0, req_minutes - counted_minutes),
        "compliant": attended_days >= req_days and counted_minutes >= req_minutes,
    }
    if include_days:
        result["days"] = days
    return result
