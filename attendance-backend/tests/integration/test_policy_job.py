from datetime import timedelta
from unittest.mock import AsyncMock

import pytest

from app.config import settings
from app.jobs import policy as job
from app.utils.timefmt import ist_today
from app.utils.weeks import week_start_of
from tests.helpers import API, ist


@pytest.fixture
def send(monkeypatch):
    mock = AsyncMock(return_value=True)
    monkeypatch.setattr("app.services.notifications.send_email", mock)
    return mock


def _prev_week():
    return week_start_of(ist_today()) - timedelta(days=7)


async def test_weekly_policy_emails_shortfall_and_digest_once(make_employee, send):
    await make_employee()
    first = await job.weekly_policy()
    assert first["week_start"] == _prev_week().isoformat()
    assert first["evaluated"] == 1 and first["shortfall_emails"] == 1 and first["digest_sent"] is True
    assert send.await_count == 2
    subjects = [c.args[1] for c in send.await_args_list]
    assert any(s.startswith("Attendance policy: shortfall") for s in subjects)
    assert any(s.startswith("Attendance digest") for s in subjects)

    second = await job.weekly_policy()  # idempotent
    assert second["shortfall_emails"] == 0 and second["digest_sent"] is False
    assert send.await_count == 2


async def test_compliant_employee_not_emailed(add_session, make_employee, send):
    emp = await make_employee()
    monday = _prev_week()
    for i in range(3):
        d = (monday + timedelta(days=i)).isoformat()
        await add_session(emp["user"]["id"], ist(d, "09:00"), ist(d, "14:00"))
    out = await job.weekly_policy()
    assert out["shortfall_emails"] == 0
    assert send.await_count == 1  # digest only
    assert "No shortfalls this week." in send.await_args.args[2]


async def test_failed_delivery_can_be_retried(db, make_employee, monkeypatch):
    await make_employee()
    monkeypatch.setattr("app.services.notifications.send_email", AsyncMock(return_value=False))
    out = await job.weekly_policy()
    assert out["shortfall_emails"] == 0 and out["digest_sent"] is False
    assert await db.notification_log.count_documents({}) == 0
    monkeypatch.setattr("app.services.notifications.send_email", AsyncMock(return_value=True))
    assert (await job.weekly_policy())["shortfall_emails"] == 1


async def test_inactive_and_future_joiners_are_not_evaluated(client, admin_headers, make_employee, send):
    inactive = await make_employee()
    await make_employee(joining_date="2999-01-01")
    await client.patch(f"{API}/users/{inactive['user']['id']}", headers=admin_headers, json={"status": "inactive"})
    out = await job.weekly_policy()
    assert out["evaluated"] == 0 and out["shortfall_emails"] == 0


async def test_admin_digest_can_be_disabled(make_employee, send, monkeypatch):
    await make_employee()
    monkeypatch.setattr(settings, "ADMIN_DIGEST_ENABLED", False)
    out = await job.weekly_policy()
    assert out["digest_sent"] is False and send.await_count == 1


async def test_midweek_reminder_is_idempotent(make_employee, send):
    await make_employee()
    first = await job.midweek_reminder()
    assert first["week_start"] == week_start_of(ist_today()).isoformat() and first["reminders"] == 1
    assert (await job.midweek_reminder())["reminders"] == 0
    assert send.await_args.args[1].startswith("Attendance reminder")


async def test_run_wrapper_swallows_job_errors(db, monkeypatch):
    monkeypatch.setattr(job, "weekly_policy", AsyncMock(side_effect=RuntimeError("boom")))
    await job.run_weekly_policy()  # must not raise
