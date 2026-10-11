from datetime import UTC, date, datetime

import pytest

from app.utils.timefmt import (
    as_utc,
    dt_fields,
    fmt_date,
    fmt_dt,
    fmt_iso,
    fmt_long,
    fmt_numeric,
    ist_date,
    parse_datetime,
)

EXPECTED = datetime(2026, 10, 9, 12, 56, 56, tzinfo=UTC)


@pytest.mark.parametrize(
    "text",
    [
        "October 9, 2026 6:26:56 PM",
        "October 09 2026 6:26:56 pm",
        "Oct 9, 2026 6:26:56 PM",
        "10-09-2026 18:26:56",
        "2026-10-09T18:26:56",
        "2026-10-09T12:56:56Z",
        "2026-10-09T18:26:56+05:30",
    ],
)
def test_parse_accepted_formats(text):
    assert parse_datetime(text) == EXPECTED


def test_parse_without_seconds():
    assert parse_datetime("October 9, 2026 6:26 PM") == datetime(
        2026, 10, 9, 12, 56, tzinfo=UTC
    )
    assert parse_datetime("10-09-2026 18:26") == datetime(
        2026, 10, 9, 12, 56, tzinfo=UTC
    )


def test_parse_datetime_object():
    naive = datetime(2026, 10, 9, 18, 26, 56)
    assert parse_datetime(naive) == EXPECTED
    assert parse_datetime(EXPECTED) == EXPECTED


@pytest.mark.parametrize("bad", ["", "   ", "not a date", "2026-13-45"])
def test_parse_rejects_garbage(bad):
    with pytest.raises(ValueError):
        parse_datetime(bad)


def test_as_utc():
    assert as_utc(datetime(2026, 1, 1, 5, 0)).tzinfo is not None
    assert as_utc(datetime(2026, 1, 1, 5, 0)).hour == 5


def test_formatters():
    assert fmt_long(EXPECTED) == "October 9, 2026 6:26:56 PM"
    assert fmt_numeric(EXPECTED) == "10-09-2026 18:26:56"
    assert fmt_iso(EXPECTED) == "2026-10-09T12:56:56Z"
    assert fmt_dt(EXPECTED, "numeric") == "10-09-2026 18:26:56"
    assert fmt_dt(EXPECTED) == "October 9, 2026 6:26:56 PM"
    assert fmt_dt(None) == ""


def test_fmt_long_midnight_and_noon():
    midnight_ist = datetime(2026, 10, 8, 18, 30, tzinfo=UTC)
    noon_ist = datetime(2026, 10, 9, 6, 30, tzinfo=UTC)
    assert fmt_long(midnight_ist) == "October 9, 2026 12:00:00 AM"
    assert fmt_long(noon_ist) == "October 9, 2026 12:00:00 PM"


def test_ist_date_crosses_utc_midnight():
    assert ist_date(datetime(2026, 10, 8, 19, 0, tzinfo=UTC)) == date(2026, 10, 9)
    assert ist_date(datetime(2026, 10, 8, 18, 0, tzinfo=UTC)) == date(2026, 10, 8)


def test_fmt_date():
    assert fmt_date(date(2026, 10, 9)) == "October 9, 2026"
    assert fmt_date(date(2026, 10, 9), "numeric") == "10-09-2026"


def test_dt_fields():
    assert dt_fields("entry_time", EXPECTED) == {
        "entry_time": "October 9, 2026 6:26:56 PM",
        "entry_time_iso": "2026-10-09T12:56:56Z",
    }
    assert dt_fields("exit_time", None) == {"exit_time": "", "exit_time_iso": ""}
