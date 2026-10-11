"""Password hashing (argon2id), JWT access tokens, opaque refresh tokens."""
from __future__ import annotations

import asyncio
import hashlib
import secrets
import uuid
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import settings
from app.core.errors import Unauthorized, Unprocessable
from app.utils.timefmt import utcnow

_ph = PasswordHasher()
_DUMMY_HASH = _ph.hash("dummy-password-for-timing-equalisation")
ALGORITHM = "HS256"


async def hash_password(password: str) -> str:
    return await asyncio.to_thread(_ph.hash, password)


async def verify_password(password: str, password_hash: str | None) -> bool:
    """Verifies against a dummy hash when the user does not exist (timing equalisation)."""
    def _verify() -> bool:
        try:
            return _ph.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
        except (VerificationError, InvalidHashError):
            return False
    return await asyncio.to_thread(_verify)


def validate_password_policy(password: str) -> None:
    problems = []
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        problems.append(f"at least {settings.PASSWORD_MIN_LENGTH} characters")
    if password.lower() == password or password.upper() == password:
        problems.append("both upper and lower case letters")
    if not any(c.isdigit() for c in password):
        problems.append("a digit")
    if problems:
        raise Unprocessable("Password must contain " + ", ".join(problems), code="WEAK_PASSWORD")


def create_access_token(user: dict) -> tuple[str, int]:
    now = utcnow()
    exp = now + timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    payload = {"sub": str(user["_id"]), "role": user["role"], "tv": user.get("token_version", 0),
               "iat": int(now.timestamp()), "exp": int(exp.timestamp()), "jti": uuid.uuid4().hex}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM), settings.ACCESS_TOKEN_MINUTES * 60


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        raise Unauthorized("Invalid or expired token", code="INVALID_TOKEN") from None


def new_opaque_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(48)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
