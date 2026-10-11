"""Request schemas for attendance. Date-times accept formats supported by app/utils/timefmt.py."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator

from app.utils.timefmt import parse_datetime


def _parse(value: Any) -> datetime | None:
    if value is None:
        return None
    return parse_datetime(value)


DateTimeIn = Annotated[datetime, BeforeValidator(_parse)]
OptDateTimeIn = Annotated[datetime | None, BeforeValidator(_parse)]


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ManualSessionIn(_Base):
    employee: str = Field(min_length=1, max_length=64)
    entry_time: DateTimeIn
    exit_time: DateTimeIn
    note: str | None = Field(None, max_length=500)


class SessionUpdateIn(_Base):
    entry_time: OptDateTimeIn = None
    exit_time: OptDateTimeIn = None
    note: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def _need_one(self) -> SessionUpdateIn:
        if self.entry_time is None and self.exit_time is None and self.note is None:
            raise ValueError("Provide entry_time, exit_time, or note")
        return self
