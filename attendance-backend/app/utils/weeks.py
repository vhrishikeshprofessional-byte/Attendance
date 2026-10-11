"""Week / day helpers. Weeks run Monday..Sunday in IST."""
from __future__ import annotations

from collections.abc import Iterable
from datetime import date, timedelta

DEFAULT_OFFS = frozenset({5, 6})


def week_start_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def week_end_of(week_start: date) -> date:
    return week_start + timedelta(days=6)


def daterange(start: date, end: date) -> Iterable[date]:
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def week_starts_between(start: date, end: date) -> list[date]:
    out, w = [], week_start_of(start)
    while w <= end:
        out.append(w)
        w += timedelta(days=7)
    return out


def is_weekly_off(d: date, offs: frozenset[int] = DEFAULT_OFFS) -> bool:
    return d.weekday() in offs


def day_type(d: date, holidays: set[date], offs: frozenset[int] = DEFAULT_OFFS) -> str:
    if is_weekly_off(d, offs):
        return "weekly_off"
    return "holiday" if d in holidays else "working"


def holidays_on_working_days(week_start: date, holidays: set[date], offs: frozenset[int] = DEFAULT_OFFS) -> int:
    return sum(1 for d in daterange(week_start, week_end_of(week_start))
               if not is_weekly_off(d, offs) and d in holidays)


def month_bounds(d: date) -> tuple[date, date]:
    first = d.replace(day=1)
    nxt = (first.replace(day=28) + timedelta(days=4)).replace(day=1)
    return first, nxt - timedelta(days=1)
