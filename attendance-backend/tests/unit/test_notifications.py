import datetime as dt
from unittest.mock import AsyncMock

from app.services import notifications as n


def result(**over):
    base = {
        "week_start": "2026-10-05", "week_end": "2026-10-11",
        "attended_days": 2, "required_days": 3,
        "counted_minutes": 600, "required_minutes": 900,
        "shortfall_days": 1, "shortfall_minutes": 300,
        "applicable": True, "compliant": False,
        "employee": {"id": "1", "employee_id": "EMP-000001", "full_name": "Asha Rao"},
    }
    base.update(over)
    return base


def test_hm_format():
    assert n._hm(0) == "0h 00m"
    assert n._hm(75) == "1h 15m"
    assert n._hm(900) == "15h 00m"


def test_weekly_shortfall_email_content():
    subject, body = n.weekly_shortfall_email("Asha", result())
    assert "October 5, 2026" in subject
    assert "Hello Asha" in body
    assert "Days attended: 2 of 3" in body
    assert "Hours counted: 10h 00m of 15h 00m" in body
    assert "Shortfall: 1 day(s), 5h 00m" in body
    assert "October 5, 2026 - October 11, 2026" in body


def test_midweek_reminder_content():
    subject, body = n.midweek_reminder_email("Asha", result())
    assert "behind" in subject
    assert "Still needed: 1 day(s), 5h 00m" in body


def test_admin_digest_lists_only_failing_applicable():
    ok = result(compliant=True, employee={"id": "2", "employee_id": "EMP-000002", "full_name": "Ok Person"})
    na = result(applicable=False, compliant=None, employee={"id": "3", "employee_id": "EMP-000003", "full_name": "New Joiner"})
    subject, body = n.admin_digest_email(dt.date(2026, 10, 5), [result(), ok, na])
    assert "week of October 5, 2026" in subject
    assert "Employees evaluated: 2" in body
    assert "Compliant: 1" in body and "Non-compliant: 1" in body
    assert "EMP-000001 Asha Rao: 2/3 days" in body
    assert "Ok Person" not in body and "New Joiner" not in body


def test_admin_digest_no_shortfalls():
    _, body = n.admin_digest_email(dt.date(2026, 10, 5), [result(compliant=True)])
    assert "No shortfalls this week." in body


def test_admin_digest_truncates_long_lists():
    many = [result() for _ in range(n._DIGEST_MAX_LINES + 7)]
    _, body = n.admin_digest_email(dt.date(2026, 10, 5), many)
    assert "... and 7 more" in body


async def test_deliver_once_is_idempotent(db, monkeypatch):
    from bson import ObjectId

    send = AsyncMock(return_value=True)
    monkeypatch.setattr("app.services.notifications.send_email", send)
    rid = ObjectId()
    assert await n.deliver_once(rid, "2026-10-05", n.WEEKLY_SHORTFALL, "a@kxn.com", "s", "b") is True
    assert await n.deliver_once(rid, "2026-10-05", n.WEEKLY_SHORTFALL, "a@kxn.com", "s", "b") is False
    assert send.await_count == 1
    # a different week or type is a different notification
    assert await n.deliver_once(rid, "2026-10-12", n.WEEKLY_SHORTFALL, "a@kxn.com", "s", "b") is True
    assert await n.deliver_once(rid, "2026-10-05", n.MIDWEEK_REMINDER, "a@kxn.com", "s", "b") is True


async def test_failed_delivery_releases_claim_for_retry(db, monkeypatch):
    from bson import ObjectId

    rid = ObjectId()
    monkeypatch.setattr("app.services.notifications.send_email", AsyncMock(return_value=False))
    assert await n.deliver_once(rid, "2026-10-05", n.WEEKLY_SHORTFALL, "a@kxn.com", "s", "b") is False
    assert await db.notification_log.count_documents({}) == 0
    monkeypatch.setattr("app.services.notifications.send_email", AsyncMock(return_value=True))
    assert await n.deliver_once(rid, "2026-10-05", n.WEEKLY_SHORTFALL, "a@kxn.com", "s", "b") is True
