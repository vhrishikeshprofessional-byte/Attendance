"""Policy notification emails with once-per-(employee, week, type) delivery."""
from __future__ import annotations

import datetime as dt
from typing import Any

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.repositories.notification_log import notification_log_repo
from app.services.email import send_email
from app.utils.timefmt import fmt_date

WEEKLY_SHORTFALL = "weekly_shortfall"
MIDWEEK_REMINDER = "midweek_reminder"
ADMIN_DIGEST = "admin_digest"
_DIGEST_MAX_LINES = 200


def _hm(minutes: int) -> str:
    hours, mins = divmod(int(minutes), 60)
    return f"{hours}h {mins:02d}m"


def _span(result: dict) -> str:
    start = dt.date.fromisoformat(result["week_start"])
    end = dt.date.fromisoformat(result["week_end"])
    return f"{fmt_date(start)} - {fmt_date(end)}"


def _progress(result: dict) -> str:
    return (
        f"Days attended: {result['attended_days']} of {result['required_days']}\n"
        f"Hours counted: {_hm(result['counted_minutes'])} of {_hm(result['required_minutes'])}\n"
    )


def weekly_shortfall_email(name: str, result: dict) -> tuple[str, str]:
    subject = (
        "Attendance policy: shortfall for week of "
        f"{fmt_date(dt.date.fromisoformat(result['week_start']))}"
    )
    body = (
        f"Hello {name},\n\n"
        f"Your attendance for {_span(result)} did not meet the weekly policy.\n\n"
        f"{_progress(result)}"
        f"Shortfall: {result['shortfall_days']} day(s), "
        f"{_hm(result['shortfall_minutes'])}\n\n"
        "If a session is missing or wrong, submit a change request in the attendance system.\n"
    )
    return subject, body


def midweek_reminder_email(name: str, result: dict) -> tuple[str, str]:
    subject = "Attendance reminder: you are behind this week's target"
    body = (
        f"Hello {name},\n\n"
        f"Progress so far for {_span(result)}:\n\n"
        f"{_progress(result)}"
        f"Still needed: {result['shortfall_days']} day(s), "
        f"{_hm(result['shortfall_minutes'])}\n"
    )
    return subject, body


def admin_digest_email(
    week_start: dt.date, results: list[dict]
) -> tuple[str, str]:
    applicable = [result for result in results if result["applicable"]]
    failing = [result for result in applicable if result["compliant"] is False]
    lines = [
        f"{result['employee']['employee_id']} "
        f"{result['employee']['full_name']}: "
        f"{result['attended_days']}/{result['required_days']} days, "
        f"{_hm(result['counted_minutes'])}/{_hm(result['required_minutes'])}"
        for result in failing[:_DIGEST_MAX_LINES]
    ]
    more = len(failing) - len(lines)
    if more > 0:
        lines.append(f"... and {more} more")
    body = (
        f"Weekly attendance digest for the week starting {fmt_date(week_start)}.\n\n"
        f"Employees evaluated: {len(applicable)}\n"
        f"Compliant: {len(applicable) - len(failing)}\n"
        f"Non-compliant: {len(failing)}\n\n"
        + ("\n".join(lines) + "\n" if lines else "No shortfalls this week.\n")
    )
    return f"Attendance digest: week of {fmt_date(week_start)}", body


async def deliver_once(
    recipient_id: ObjectId,
    week_start: str,
    kind: str,
    to: str,
    subject: str,
    body: str,
) -> bool:
    """Claim (recipient, week, kind) then send; release the claim if delivery fails."""
    try:
        entry: Any = await notification_log_repo.insert(
            {"employee_id": recipient_id, "week_start": week_start, "type": kind}
        )
    except DuplicateKeyError:
        return False
    if await send_email(to, subject, body):
        return True
    await notification_log_repo.delete_one({"_id": entry["_id"]})
    return False
