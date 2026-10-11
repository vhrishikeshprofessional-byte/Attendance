from datetime import date

from app.utils.weeks import (
    daterange,
    day_type,
    holidays_on_working_days,
    is_weekly_off,
    month_bounds,
    week_end_of,
    week_start_of,
    week_starts_between,
)

FRI = date(2026, 10, 9)
MON = date(2026, 10, 5)


def test_week_start_and_end():
    assert week_start_of(FRI) == MON
    assert week_start_of(MON) == MON
    assert week_start_of(date(2026, 10, 11)) == MON
    assert week_end_of(MON) == date(2026, 10, 11)


def test_daterange_is_inclusive():
    days = list(daterange(MON, date(2026, 10, 11)))
    assert len(days) == 7
    assert days[0] == MON and days[-1] == date(2026, 10, 11)
    assert list(daterange(MON, MON)) == [MON]
    assert list(daterange(date(2026, 10, 6), MON)) == []


def test_week_starts_between():
    assert week_starts_between(FRI, date(2026, 10, 20)) == [
        MON,
        date(2026, 10, 12),
        date(2026, 10, 19),
    ]
    assert week_starts_between(MON, MON) == [MON]


def test_weekly_off_defaults():
    assert is_weekly_off(date(2026, 10, 10))
    assert is_weekly_off(date(2026, 10, 11))
    assert not is_weekly_off(MON)
    assert is_weekly_off(MON, frozenset({0}))


def test_day_type():
    holidays = {date(2026, 10, 7), date(2026, 10, 10)}
    assert day_type(date(2026, 10, 6), holidays) == "working"
    assert day_type(date(2026, 10, 7), holidays) == "holiday"
    assert day_type(date(2026, 10, 10), holidays) == "weekly_off"


def test_holidays_on_working_days():
    holidays = {date(2026, 10, 7), date(2026, 10, 10)}
    assert holidays_on_working_days(MON, holidays) == 1
    assert holidays_on_working_days(MON, set()) == 0


def test_month_bounds():
    assert month_bounds(date(2026, 2, 15)) == (
        date(2026, 2, 1),
        date(2026, 2, 28),
    )
    assert month_bounds(date(2028, 2, 10)) == (
        date(2028, 2, 1),
        date(2028, 2, 29),
    )
    assert month_bounds(date(2026, 12, 31)) == (
        date(2026, 12, 1),
        date(2026, 12, 31),
    )
