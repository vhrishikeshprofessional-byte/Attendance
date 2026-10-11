"""Request schemas for teams."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TeamCreate(_Base):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)


class TeamUpdate(_Base):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)  # null clears it

class TeamMembers(_Base):
    member_ids: list[str] = Field(default_factory=list)
