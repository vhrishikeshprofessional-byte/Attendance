"""Request schemas for attendance change requests."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models.attendance import OptDateTimeIn

Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChangeRequestCreate(_Base):
    """Add needs both times; edit needs a session and at least one time; delete needs a session."""

    action: Literal["add", "edit", "delete"]
    session_id: str | None = Field(default=None, max_length=64)
    entry_time: OptDateTimeIn = None
    exit_time: OptDateTimeIn = None
    reason: Reason

    @model_validator(mode="after")
    def _check_shape(self) -> ChangeRequestCreate:
        if self.action == "add":
            if self.session_id is not None:
                raise ValueError("session_id must not be set when adding a session")
            if self.entry_time is None or self.exit_time is None:
                raise ValueError("entry_time and exit_time are required when adding a session")
        elif self.action == "edit":
            if not self.session_id:
                raise ValueError("session_id is required when editing a session")
            if self.entry_time is None and self.exit_time is None:
                raise ValueError("Provide entry_time and/or exit_time")
        else:
            if not self.session_id:
                raise ValueError("session_id is required when deleting a session")
            if self.entry_time is not None or self.exit_time is not None:
                raise ValueError("entry_time and exit_time must not be set when deleting")
        return self


class ApproveIn(_Base):
    note: Note | None = None


class RejectIn(_Base):
    note: Note
