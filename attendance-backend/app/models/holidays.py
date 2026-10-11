"""Request schemas for holidays."""
from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field, field_validator

MIN_DATE, MAX_DATE = dt.date(2000, 1, 1), dt.date(2100, 12, 31)


def _check_range(value: dt.date | None) -> dt.date | None:
    if value is not None and not (MIN_DATE <= value <= MAX_DATE):
        raise ValueError("date must be between 2000-01-01 and 2100-12-31")
    return value


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HolidayCreate(_Base):
    date: dt.date
    name: str = Field(min_length=1, max_length=120)

    _range = field_validator("date")(_check_range)


class HolidayUpdate(_Base):
    date: dt.date | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)

    _range = field_validator("date")(_check_range)
