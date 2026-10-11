from datetime import date

from app.services.policy import evaluate_week

MON = date(2026, 10, 5)
TUE, WED, THU, FRI = (date(2026, 10, d) for d in (6, 7, 8, 9))


def test_exactly_60_minutes_counts_as_attended():
    r = evaluate_week(MON, {MON: 60, TUE: 60, WED: 60}, set())
    assert r["attended_days"] == 3 and r["counted_minutes"] == 180
    assert r["shortfall_minutes"] == 720 and r["compliant"] is False


def test_short_days_minutes_are_not_counted_toward_hours():
    r = evaluate_week(MON, {MON: 59, TUE: 300, WED: 300, THU: 300}, set())
    assert r["attended_days"] == 3 and r["counted_minutes"] == 900 and r["compliant"] is True


def test_more_than_required_days_still_compliant_and_all_counted():
    r = evaluate_week(MON, {MON: 300, TUE: 300, WED: 300, THU: 300, FRI: 300}, set())
    assert r["counted_minutes"] == 1500 and r["shortfall_days"] == 0 and r["compliant"] is True


def test_holiday_day_reports_holiday_type_in_days():
    days = evaluate_week(MON, {}, {WED})["days"]
    assert days[2]["day_type"] == "holiday"
    assert days[5]["day_type"] == days[6]["day_type"] == "weekly_off"


def test_custom_weekly_offs():
    r = evaluate_week(MON, {}, set(), offs=frozenset({6}))
    assert r["days"][5]["day_type"] == "working" and r["days"][6]["day_type"] == "weekly_off"
