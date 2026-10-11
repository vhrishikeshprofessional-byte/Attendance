import datetime as dt

import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.jobs.scheduler import parse_cron, register_jobs


def test_parse_cron_weekly_trigger():
    trigger = parse_cron("mon 09:00")
    nxt = trigger.get_next_fire_time(None, dt.datetime(2026, 10, 10, tzinfo=settings.tz))  # a Saturday
    assert (nxt.year, nxt.month, nxt.day, nxt.hour, nxt.minute) == (2026, 10, 12, 9, 0)
    assert nxt.weekday() == 0


def test_parse_cron_is_case_insensitive():
    assert parse_cron("THU 16:30").get_next_fire_time(None, dt.datetime(2026, 10, 10, tzinfo=settings.tz)).weekday() == 3


@pytest.mark.parametrize("bad", ["", "mon", "mon 9", "mon 09:xx"])
def test_parse_cron_rejects_bad_input(bad):
    with pytest.raises(ValueError):
        parse_cron(bad)


async def test_midweek_job_only_registered_when_enabled(monkeypatch):
    monkeypatch.setattr(settings, "MIDWEEK_REMINDER_ENABLED", False)
    s = AsyncIOScheduler(timezone=settings.tz)
    register_jobs(s)
    assert s.get_job("weekly_policy") is not None and s.get_job("midweek_reminder") is None

    monkeypatch.setattr(settings, "MIDWEEK_REMINDER_ENABLED", True)
    s2 = AsyncIOScheduler(timezone=settings.tz)
    register_jobs(s2)
    assert s2.get_job("midweek_reminder") is not None
