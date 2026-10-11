"""Request/response schemas for authentication."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginIn(_Base):
    identifier: str = Field(min_length=1, max_length=254)  # work email or employee code
    password: str = Field(min_length=1, max_length=256)

class SignupIn(_Base):
    work_email: EmailStr
    password: str = Field(min_length=1, max_length=256)
    full_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=20)



class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshIn(_Base):
    refresh_token: str = Field(min_length=1, max_length=512)


class LogoutIn(_Base):
    refresh_token: str | None = Field(default=None, max_length=512)


class ForgotPasswordIn(_Base):
    email: EmailStr


class ResetPasswordIn(_Base):
    token: str = Field(min_length=1, max_length=512)
    new_password: str = Field(min_length=1, max_length=256)


class ChangePasswordIn(_Base):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=1, max_length=256)


class MessageOut(BaseModel):
    message: str
