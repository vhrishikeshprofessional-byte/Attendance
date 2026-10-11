import datetime as dt
from datetime import timedelta

import pytest

from app.core.errors import Unprocessable
from app.services.attendance import session_fields, validate_times

UTC = dt.UTC
NOW = dt.datetime(2026, 10, 9, 13, 0, tzinfo=UTC)


def code(entry, exit_):
    with pytest.raises(Unprocessable) as exc:
        validate_times(entry, exit_, NOW)
    return exc.value.code


def test_valid_session():
    validate_times(NOW - timedelta(hours=5), NOW - timedelta(hours=1), NOW)


def test_open_session_only_checks_entry():
    validate_times(NOW - timedelta(hours=1), None, NOW)


def test_future_entry_rejected_but_small_skew_tolerated():
    validate_times(NOW + timedelta(seconds=30), None, NOW)
    assert code(NOW + timedelta(minutes=5), None) == "FUTURE_TIME"


def test_future_exit_rejected():
    assert code(NOW - timedelta(hours=2), NOW + timedelta(minutes=5)) == "FUTURE_TIME"


@pytest.mark.parametrize("delta", [timedelta(0), timedelta(minutes=-1)])
def test_exit_must_be_after_entry(delta):
    entry = NOW - timedelta(hours=3)
    assert code(entry, entry + delta) == "EXIT_BEFORE_ENTRY"


def test_max_duration_boundary():
    entry = NOW - timedelta(hours=16)
    validate_times(entry, NOW, NOW)  # exactly 16h is allowed
    assert code(entry - timedelta(minutes=1), NOW) == "SESSION_TOO_LONG"


def test_session_fields_closed():
    entry = dt.datetime(2026, 10, 8, 19, 0, tzinfo=UTC)  # 00:30 IST on Oct 9 (Friday)
    f = session_fields(entry, entry + timedelta(minutes=90))
    assert f["date"] == "2026-10-09"
    assert f["week_start"] == "2026-10-05"
    assert f["duration_minutes"] == 90
    assert f["is_open"] is False


def test_session_fields_open():
    f = session_fields(dt.datetime(2026, 10, 9, 4, 0, tzinfo=UTC), None)
    assert f["is_open"] is True and f["duration_minutes"] is None and f["exit_time"] is None


def test_session_fields_sunday_belongs_to_monday_week():
    f = session_fields(dt.datetime(2026, 10, 10, 20, 0, tzinfo=UTC), None)  # Oct 11 IST, Sunday
    assert f["date"] == "2026-10-11" and f["week_start"] == "2026-10-05"
