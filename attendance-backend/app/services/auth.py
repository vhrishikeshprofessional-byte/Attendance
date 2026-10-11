"""Authentication use-cases: login, refresh-token rotation, logout, and password management."""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any

from app.config import settings
from app.core.errors import AppError, Conflict, Unauthorized, Unprocessable
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_opaque_token,
    validate_password_policy,
    verify_password,
)
from app.db.client import run_txn
from app.repositories.password_resets import password_resets_repo
from app.repositories.refresh_tokens import refresh_tokens_repo
from app.repositories.users import users_repo
from app.services.audit import log_audit
from app.services.email import send_password_reset
from app.utils.timefmt import as_utc, utcnow

log = logging.getLogger("app.auth")
_background: set[asyncio.Task[None]] = set()


def _locked(user: dict, now: datetime) -> bool:
    until = user.get("locked_until")
    return until is not None and as_utc(until) > now


async def _issue_tokens(user: dict, family_id: str | None = None) -> dict:
    access, expires_in = create_access_token(user)
    raw_token, token_hash = new_opaque_token()
    await refresh_tokens_repo.insert(
        {
            "user_id": user["_id"],
            "token_hash": token_hash,
            "family_id": family_id or uuid.uuid4().hex,
            "revoked": False,
            "expires_at": utcnow() + timedelta(days=settings.REFRESH_TOKEN_DAYS),
        }
    )
    return {
        "access_token": access,
        "refresh_token": raw_token,
        "token_type": "bearer",
        "expires_in": expires_in,
    }


async def _register_failure(user: dict) -> None:
    updated = await users_repo.update(
        {"_id": user["_id"]}, {"$inc": {"failed_login_count": 1}}, bump=False
    )
    if updated and int(updated.get("failed_login_count", 0)) >= settings.LOGIN_MAX_FAILURES:
        await users_repo.update(
            {"_id": user["_id"]},
            {
                "$set": {
                    "failed_login_count": 0,
                    "locked_until": utcnow() + timedelta(minutes=settings.LOGIN_LOCK_MINUTES),
                }
            },
            bump=False,
        )
        await log_audit(
            None,
            "auth.account_locked",
            "user",
            user["_id"],
            meta={"lock_minutes": settings.LOGIN_LOCK_MINUTES},
        )


from app.repositories.locks import next_sequence
from app.services.users import _check_domain


async def signup(data: Any) -> dict:
    email = str(data.work_email).strip().lower()
    _check_domain(email)
    validate_password_policy(data.password)
    if await users_repo.find_one({"work_email": email}):
        raise Conflict("A user with this email already exists", code="EMAIL_TAKEN")
    
    password_hash = await hash_password(data.password)
    seq = await next_sequence("employee_id")
    now = utcnow()
    doc = {
        "role": "employee",
        "status": "active",
        "is_deleted": False,
        "work_email": email,
        "employee_id": f"EMP-{seq:06d}",
        "password_hash": password_hash,
        "failed_login_count": 0,
        "locked_until": None,
        "token_version": 0,
        "personal": {"full_name": data.full_name.strip(), "phone": data.phone},
        "professional": {
            "joining_date": now.date().isoformat(),
            "team_ids": [],
        },
        "version": 1,
        "created_at": now,
        "updated_at": now,
    }

    async def _tx(session):
        created = await users_repo.insert(doc, session=session)
        await log_audit(created["_id"], "auth.signup", "user", created["_id"], after=created, session=session)
        return created

    created = await run_txn(_tx)
    return await _issue_tokens(created)

async def login(identifier: str, password: str) -> dict:
    now = utcnow()
    user = await users_repo.find_by_login(identifier)
    if user is not None and _locked(user, now):
        raise Unauthorized(
            "Too many failed attempts. Try again later.", code="ACCOUNT_LOCKED"
        )
    valid = await verify_password(
        password, user.get("password_hash") if user is not None else None
    )
    if not valid:
        if user is not None:
            await _register_failure(user)
        raise Unauthorized("Invalid credentials", code="INVALID_CREDENTIALS")
    if user is None:
        raise Unauthorized("Invalid credentials", code="INVALID_CREDENTIALS")
    if user.get("status") != "active":
        raise Unauthorized("Account is not active", code="INACTIVE_ACCOUNT")
    if user.get("failed_login_count") or user.get("locked_until"):
        await users_repo.update(
            {"_id": user["_id"]},
            {"$set": {"failed_login_count": 0, "locked_until": None}},
            bump=False,
        )
    return await _issue_tokens(user)


async def refresh(raw_token: str) -> dict:
    """Rotate a refresh token; reuse of a spent token revokes its family."""
    now = utcnow()
    token_doc = await refresh_tokens_repo.find_one(
        {"token_hash": hash_token(raw_token)}
    )
    if token_doc is None:
        raise Unauthorized(
            "Invalid or expired refresh token", code="INVALID_REFRESH_TOKEN"
        )
    if token_doc.get("revoked"):
        await refresh_tokens_repo.revoke_family(token_doc["family_id"])
        raise Unauthorized(
            "Invalid or expired refresh token", code="INVALID_REFRESH_TOKEN"
        )
    if as_utc(token_doc["expires_at"]) <= now:
        raise Unauthorized(
            "Invalid or expired refresh token", code="INVALID_REFRESH_TOKEN"
        )
    claimed = await refresh_tokens_repo.update(
        {"_id": token_doc["_id"], "revoked": False},
        {"$set": {"revoked": True, "rotated_at": now}},
        bump=False,
    )
    if claimed is None:
        await refresh_tokens_repo.revoke_family(token_doc["family_id"])
        raise Unauthorized(
            "Invalid or expired refresh token", code="INVALID_REFRESH_TOKEN"
        )
    user = await users_repo.get(token_doc["user_id"])
    if user is None or user.get("is_deleted") or user.get("status") != "active":
        await refresh_tokens_repo.revoke_family(token_doc["family_id"])
        raise Unauthorized("Account is not active", code="INACTIVE_ACCOUNT")
    return await _issue_tokens(user, family_id=token_doc["family_id"])


async def logout(raw_token: str | None) -> None:
    """Revoke the token family; an absent or unknown token is safe to ignore."""
    if not raw_token:
        return
    token_doc = await refresh_tokens_repo.find_one(
        {"token_hash": hash_token(raw_token)}
    )
    if token_doc is not None:
        await refresh_tokens_repo.revoke_family(token_doc["family_id"])


async def _send_reset_email(to: str, name: str, token: str) -> None:
    try:
        await send_password_reset(to, name, token)
    except Exception:
        log.exception("password reset email task failed")


async def forgot_password(email: str) -> None:
    """Never reveals whether the email exists."""
    user = await users_repo.find_one(
        {
            "work_email": email.strip().lower(),
            "is_deleted": {"$ne": True},
            "status": "active",
        }
    )
    if user is None:
        return
    now = utcnow()
    await password_resets_repo.col.update_many(
        {"user_id": user["_id"], "used": False},
        {"$set": {"used": True, "used_at": now}},
    )
    raw_token, token_hash = new_opaque_token()
    await password_resets_repo.insert(
        {
            "user_id": user["_id"],
            "token_hash": token_hash,
            "used": False,
            "expires_at": now + timedelta(minutes=settings.RESET_TOKEN_MINUTES),
        }
    )
    name = (user.get("personal") or {}).get("full_name") or "there"
    task: asyncio.Task[None] = asyncio.create_task(
        _send_reset_email(user["work_email"], name, raw_token)
    )
    _background.add(task)
    task.add_done_callback(_background.discard)


async def reset_password(raw_token: str, new_password: str) -> None:
    validate_password_policy(new_password)
    now = utcnow()
    reset = await password_resets_repo.update(
        {
            "token_hash": hash_token(raw_token),
            "used": False,
            "expires_at": {"$gt": now},
        },
        {"$set": {"used": True, "used_at": now}},
        bump=False,
    )
    if reset is None:
        raise Unprocessable(
            "Reset link is invalid or has expired", code="INVALID_RESET_TOKEN"
        )
    new_hash = await hash_password(new_password)

    async def _tx(session: Any) -> None:
        updated = await users_repo.update(
            {"_id": reset["user_id"], "is_deleted": {"$ne": True}},
            {
                "$set": {
                    "password_hash": new_hash,
                    "failed_login_count": 0,
                    "locked_until": None,
                },
                "$inc": {"token_version": 1},
            },
            session=session,
        )
        if updated is None:
            raise Unprocessable(
                "Reset link is invalid or has expired", code="INVALID_RESET_TOKEN"
            )
        await log_audit(
            updated["_id"],
            "auth.password_reset",
            "user",
            updated["_id"],
            session=session,
        )

    await run_txn(_tx)
    await refresh_tokens_repo.revoke_all_for_user(reset["user_id"])


async def change_password(
    user: dict, current_password: str, new_password: str
) -> dict:
    """Change the password, revoke prior sessions, and return a fresh token pair."""
    if not await verify_password(current_password, user.get("password_hash")):
        raise Unprocessable(
            "Current password is incorrect", code="INVALID_CURRENT_PASSWORD"
        )
    if current_password == new_password:
        raise Unprocessable(
            "New password must differ from the current password", code="SAME_PASSWORD"
        )
    validate_password_policy(new_password)
    new_hash = await hash_password(new_password)

    async def _tx(session: Any) -> dict:
        updated = await users_repo.update(
            {"_id": user["_id"], "is_deleted": {"$ne": True}},
            {
                "$set": {
                    "password_hash": new_hash,
                    "failed_login_count": 0,
                    "locked_until": None,
                },
                "$inc": {"token_version": 1},
            },
            session=session,
        )
        if updated is None:
            raise AppError("Account not found", code="USER_NOT_FOUND", status_code=404)
        await log_audit(
            user["_id"],
            "auth.password_changed",
            "user",
            user["_id"],
            session=session,
        )
        return updated

    updated = await run_txn(_tx)
    await refresh_tokens_repo.revoke_all_for_user(user["_id"])
    return await _issue_tokens(updated)
