"""Request schemas for user management."""
from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

_PHONE = r"^[0-9+\-\s()]{7,20}$"


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


class UserCreate(_Base):
    work_email: EmailStr
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=256)  # policy enforced in the service
    joining_date: date | None = None  # defaults to today (IST)
    team_ids: list[str] = Field(default_factory=list, max_length=50)
    phone: str | None = Field(default=None, pattern=_PHONE)


class UserUpdate(_Base):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, pattern=_PHONE)  # null clears it
    joining_date: date | None = None
    team_ids: list[str] | None = Field(default=None, max_length=50)
    status: Literal["active", "inactive"] | None = None


class WarningEmailRequest(_Base):
    week_start: date
    week_end: date
    office_days_attended: int
    office_days_required: int
    total_hours_attended: float
    total_hours_required: float
    avg_hours_attended: float
    avg_hours_required: float
    violation_reasons: list[str]
