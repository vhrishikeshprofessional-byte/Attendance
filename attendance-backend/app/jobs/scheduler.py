"""APScheduler setup: weekly policy job and optional mid-week reminder."""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.jobs.policy import run_midweek_reminder, run_weekly_policy

log = logging.getLogger("app.jobs")
_scheduler: AsyncIOScheduler | None = None


def parse_cron(expr: str) -> CronTrigger:
    """Parse '<day> HH:MM' (e.g. 'mon 09:00') into a weekly trigger."""
    day, clock = expr.split()
    hour, minute = clock.split(":")
    return CronTrigger(
        day_of_week=day.lower(),
        hour=int(hour),
        minute=int(minute),
        timezone=settings.tz,
    )


def register_jobs(scheduler: AsyncIOScheduler) -> None:
    opts = {"coalesce": True, "max_instances": 1, "misfire_grace_time": 3600}
    scheduler.add_job(
        run_weekly_policy,
        parse_cron(settings.POLICY_JOB_CRON),
        id="weekly_policy",
        replace_existing=True,
        **opts,
    )
    if settings.MIDWEEK_REMINDER_ENABLED:
        scheduler.add_job(
            run_midweek_reminder,
            parse_cron(settings.MIDWEEK_REMINDER_CRON),
            id="midweek_reminder",
            replace_existing=True,
            **opts,
        )


def start_scheduler() -> None:
    global _scheduler
    if not settings.SCHEDULER_ENABLED or _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone=settings.tz)
    register_jobs(_scheduler)
    _scheduler.start()
    log.info("scheduler started")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("scheduler stopped")
