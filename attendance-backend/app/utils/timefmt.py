"""Parsing and formatting of date-times. Stored values are UTC; business rules use IST.
Strings without an offset are read as IST."""
from __future__ import annotations

from datetime import UTC, date, datetime

from app.config import settings

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]

_FORMATS = [
    "%B %d, %Y %I:%M:%S %p", "%B %d %Y %I:%M:%S %p",
    "%b %d, %Y %I:%M:%S %p", "%b %d %Y %I:%M:%S %p",
    "%B %d, %Y %I:%M %p", "%B %d %Y %I:%M %p",
    "%m-%d-%Y %H:%M:%S", "%m-%d-%Y %H:%M",
]


def as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def utcnow() -> datetime:
    return datetime.now(UTC)


def parse_datetime(value: str | datetime) -> datetime:
    """Parse any accepted input into an aware UTC datetime."""
    if isinstance(value, datetime):
        dt = value
    else:
        s = " ".join(str(value).strip().split())
        if not s:
            raise ValueError("empty date-time")
        dt = None
        upper = s.upper()
        for fmt in _FORMATS:
            try:
                dt = datetime.strptime(upper if "%p" in fmt else s, fmt)
                break
            except ValueError:
                continue
        if dt is None:
            try:
                dt = datetime.fromisoformat(s.replace("Z", "+00:00").replace("z", "+00:00"))
            except ValueError:
                raise ValueError("Unrecognised date-time. Use e.g. 'October 9, 2026 6:26:56 PM', "
                                 "'10-09-2026 18:26:56' or ISO 8601.") from None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=settings.tz)
    return dt.astimezone(UTC)


def to_ist(dt: datetime) -> datetime:
    return as_utc(dt).astimezone(settings.tz)


def ist_date(dt: datetime) -> date:
    return to_ist(dt).date()


def ist_today() -> date:
    return utcnow().astimezone(settings.tz).date()


def fmt_long(dt: datetime) -> str:
    d = to_ist(dt)
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year} {d.hour % 12 or 12}:{d.minute:02d}:{d.second:02d} {'AM' if d.hour < 12 else 'PM'}"


def fmt_numeric(dt: datetime) -> str:
    return to_ist(dt).strftime("%m-%d-%Y %H:%M:%S")


def fmt_iso(dt: datetime) -> str:
    return as_utc(dt).strftime("%Y-%m-%dT%H:%M:%SZ")


def fmt_dt(dt: datetime | None, style: str = "long") -> str:
    if dt is None:
        return ""
    return fmt_numeric(dt) if style == "numeric" else fmt_long(dt)


def fmt_date(d: date, style: str = "long") -> str:
    if style == "numeric":
        return d.strftime("%m-%d-%Y")
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"


def dt_fields(prefix: str, dt: datetime | None, style: str = "long") -> dict:
    return {prefix: fmt_dt(dt, style), f"{prefix}_iso": fmt_iso(dt) if dt else ""}
