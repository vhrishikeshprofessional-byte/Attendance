"""Scheduled policy jobs. Each run is guarded by a Mongo lock."""
from __future__ import annotations

import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import timedelta
from typing import Any

from app.config import settings
from app.repositories.locks import acquire_lock, release_lock
from app.repositories.users import users_repo
from app.services import notifications as notes
from app.services.reports import list_active_employees, week_results
from app.utils.timefmt import ist_today
from app.utils.weeks import week_start_of

log = logging.getLogger("app.jobs")
_LOCK_TTL_SECONDS = 1800


def _name(user: dict) -> str:
    return (user.get("personal") or {}).get("full_name") or "there"


async def weekly_policy() -> dict:
    """Evaluate the previous completed week; email shortfalls and the admin digest."""
    week_start = week_start_of(ist_today()) - timedelta(days=7)
    iso = week_start.isoformat()
    employees, _ = await list_active_employees(week_start)
    results = await week_results(week_start, employees)
    by_id = {str(employee["_id"]): employee for employee in employees}

    sent = 0
    for result in results:
        if not result["applicable"] or result["compliant"] is not False:
            continue
        user = by_id[result["employee"]["id"]]
        subject, body = notes.weekly_shortfall_email(_name(user), result)
        if await notes.deliver_once(
            user["_id"],
            iso,
            notes.WEEKLY_SHORTFALL,
            user["work_email"],
            subject,
            body,
        ):
            sent += 1

    digest = False
    if settings.ADMIN_DIGEST_ENABLED:
        admin = await users_repo.find_one(
            {"role": "admin", "is_deleted": {"$ne": True}}
        )
        if admin is not None:
            subject, body = notes.admin_digest_email(week_start, results)
            digest = await notes.deliver_once(
                admin["_id"],
                iso,
                notes.ADMIN_DIGEST,
                admin["work_email"],
                subject,
                body,
            )
    return {
        "week_start": iso,
        "evaluated": len(results),
        "shortfall_emails": sent,
        "digest_sent": digest,
    }


async def midweek_reminder() -> dict:
    """Remind employees who are not yet on track for the current week."""
    week_start = week_start_of(ist_today())
    iso = week_start.isoformat()
    employees, _ = await list_active_employees(week_start)
    results = await week_results(week_start, employees)
    by_id = {str(employee["_id"]): employee for employee in employees}

    sent = 0
    for result in results:
        if not result["applicable"] or result["compliant"] is not False:
            continue
        user = by_id[result["employee"]["id"]]
        subject, body = notes.midweek_reminder_email(_name(user), result)
        if await notes.deliver_once(
            user["_id"],
            iso,
            notes.MIDWEEK_REMINDER,
            user["work_email"],
            subject,
            body,
        ):
            sent += 1
    return {"week_start": iso, "evaluated": len(results), "reminders": sent}


async def _run_locked(
    job: str, fn: Callable[[], Awaitable[dict[str, Any]]]
) -> None:
    owner = uuid.uuid4().hex
    lock_name = f"job:{job}:{week_start_of(ist_today()).isoformat()}"
    if not await acquire_lock(lock_name, _LOCK_TTL_SECONDS, owner):
        log.info("job skipped; another instance holds the lock", extra={"path": job})
        return
    try:
        summary = await fn()
        log.info("job finished: %s %s", job, summary)
    except Exception:
        log.exception("job failed: %s", job)
    finally:
        await release_lock(lock_name, owner)


async def run_weekly_policy() -> None:
    await _run_locked("weekly_policy", weekly_policy)


async def run_midweek_reminder() -> None:
    await _run_locked("midweek_reminder", midweek_reminder)
