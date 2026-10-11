"""Admin bootstrap: .env is only a seed; afterwards credentials live in the DB."""
from __future__ import annotations

import logging

from app.config import settings
from app.core.security import hash_password, validate_password_policy
from app.db.client import get_db
from app.utils.timefmt import ist_today, utcnow

log = logging.getLogger("app.seed")


async def ensure_admin() -> None:
    users = get_db()["users"]
    if await users.find_one({"role": "admin"}):
        return
    if not settings.ADMIN_PASSWORD:
        raise RuntimeError("No admin exists and ADMIN_PASSWORD is not set. Set it in .env for the first launch.")
    validate_password_policy(settings.ADMIN_PASSWORD)
    now = utcnow()
    await users.insert_one({
        "role": "admin", "status": "active", "is_deleted": False,
        "work_email": settings.ADMIN_EMAIL.strip().lower(), "employee_id": "ADMIN",
        "password_hash": await hash_password(settings.ADMIN_PASSWORD),
        "failed_login_count": 0, "locked_until": None, "token_version": 0,
        "personal": {"full_name": "Administrator"},
        "professional": {"joining_date": ist_today().isoformat(), "team_ids": []},
        "version": 1, "created_at": now, "updated_at": now,
    })
    log.info("admin account created from environment seed")
