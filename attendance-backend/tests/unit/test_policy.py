from datetime import date

from app.services.policy import evaluate_week, is_attended, required_days

MON = date(2026, 10, 5)
TUE, WED = date(2026, 10, 6), date(2026, 10, 7)
SAT = date(2026, 10, 10)


def test_is_attended_threshold():
    assert not is_attended(0)
    assert not is_attended(59)
    assert is_attended(60)
    assert is_attended(600)


def test_required_days_reduced_by_working_day_holidays():
    assert required_days(MON, set()) == 3
    assert required_days(MON, {WED}) == 2
    assert required_days(MON, {SAT}) == 3
    assert required_days(MON, {MON, TUE, WED}) == 0
    assert required_days(MON, {MON, TUE, WED, date(2026, 10, 8)}) == 0


def test_required_days_capped_by_working_days():
    assert required_days(MON, set(), frozenset({0, 1, 2, 3, 4, 5})) == 1


def test_compliant_week():
    result = evaluate_week(MON, {MON: 300, TUE: 300, WED: 300}, set())
    assert result["compliant"] is True
    assert result["required_days"] == 3
    assert result["required_minutes"] == 900
    assert result["attended_days"] == 3
    assert result["counted_minutes"] == 900
    assert result["shortfall_days"] == 0
    assert result["shortfall_minutes"] == 0


def test_enough_days_but_not_enough_hours():
    result = evaluate_week(MON, {MON: 200, TUE: 200, WED: 200}, set())
    assert result["attended_days"] == 3
    assert result["counted_minutes"] == 600
    assert result["shortfall_days"] == 0
    assert result["shortfall_minutes"] == 300
    assert result["compliant"] is False


def test_short_day_is_not_counted():
    result = evaluate_week(MON, {MON: 30, TUE: 300, WED: 300}, set())
    assert result["attended_days"] == 2
    assert result["counted_minutes"] == 600
    assert result["shortfall_days"] == 1
    assert result["compliant"] is False


def test_weekend_minutes_are_extra_only():
    result = evaluate_week(
        MON, {MON: 300, TUE: 300, WED: 300, SAT: 120}, set()
    )
    assert result["extra_minutes"] == 120
    assert result["counted_minutes"] == 900
    assert result["compliant"] is True


def test_holiday_reduces_requirement_and_minutes_become_extra():
    result = evaluate_week(MON, {MON: 300, TUE: 300, WED: 100}, {WED})
    assert result["holidays_on_working_days"] == 1
    assert result["required_days"] == 2
    assert result["required_minutes"] == 600
    assert result["extra_minutes"] == 100
    assert result["compliant"] is True


def test_empty_week_fails():
    result = evaluate_week(MON, {}, set())
    assert result["attended_days"] == 0
    assert result["shortfall_days"] == 3
    assert result["shortfall_minutes"] == 900
    assert result["compliant"] is False


def test_all_holidays_week_is_compliant():
    result = evaluate_week(MON, {}, {MON, TUE, WED})
    assert result["required_days"] == 0
    assert result["compliant"] is True


def test_include_days_flag():
    assert "days" not in evaluate_week(MON, {}, set(), include_days=False)
    days = evaluate_week(MON, {MON: 300}, set())["days"]
    assert len(days) == 7
    assert days[0] == {
        "date": "2026-10-05",
        "day_type": "working",
        "minutes": 300,
        "attended": True,
    }
    assert days[5]["day_type"] == "weekly_off"
    assert result_keys_ok(evaluate_week(MON, {}, set()))


def result_keys_ok(result: dict) -> bool:
    return result["week_start"] == "2026-10-05" and result["week_end"] == "2026-10-11"
