"""User management use-cases (admin creates/edits/deactivates employees)."""
from __future__ import annotations

import html

from bson import ObjectId

from app.config import settings
from app.core.errors import Conflict, Forbidden, NotFound, Unprocessable
from app.core.security import hash_password, validate_password_policy
from app.db.client import run_txn
from app.models.users import UserCreate, UserUpdate, WarningEmailRequest
from app.repositories.locks import next_sequence
from app.repositories.refresh_tokens import refresh_tokens_repo
from app.repositories.teams import teams_repo
from app.repositories.users import users_repo
from app.services.audit import log_audit
from app.utils.timefmt import ist_today, utcnow

PRIVATE_FIELDS = ("password_hash", "failed_login_count", "locked_until", "token_version")


def _check_domain(email: str) -> None:
    domains = settings.signup_domains
    if domains and email.rsplit("@", 1)[-1] not in domains:
        raise Unprocessable("Email domain is not allowed", code="EMAIL_DOMAIN_NOT_ALLOWED")


async def _resolve_teams(raw_ids: list[str]) -> list[ObjectId]:
    ids: list[ObjectId] = []
    for raw_id in raw_ids:
        if not ObjectId.is_valid(raw_id):
            raise Unprocessable("Invalid team id", code="INVALID_TEAM", details={"team_id": raw_id})
        oid = ObjectId(raw_id)
        if oid not in ids:
            ids.append(oid)
    if ids:
        found = await teams_repo.count({"_id": {"$in": ids}, "is_deleted": {"$ne": True}})
        if found != len(ids):
            raise Unprocessable("One or more teams do not exist", code="INVALID_TEAM")
    return ids


async def get_user(ident: str) -> dict:
    user = await users_repo.resolve(ident)
    if user is None:
        raise NotFound("User not found", code="USER_NOT_FOUND")
    return user


async def create_user(actor: dict, data: UserCreate) -> dict:
    email = str(data.work_email).strip().lower()
    _check_domain(email)
    validate_password_policy(data.password)
    if await users_repo.find_one({"work_email": email}):
        raise Conflict("A user with this email already exists", code="EMAIL_TAKEN")
    team_ids = await _resolve_teams(data.team_ids)
    password_hash = await hash_password(data.password)
    seq = await next_sequence("employee_id")  # outside the txn: gaps are fine, reuse is not
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
            "joining_date": (data.joining_date or ist_today()).isoformat(),
            "team_ids": team_ids,
        },
        "version": 1,
        "created_at": now,
        "updated_at": now,
    }

    async def _tx(session):
        created = await users_repo.insert(doc, session=session)
        await log_audit(actor["_id"], "user.created", "user", created["_id"], after=created, session=session)
        return created

    return await run_txn(_tx)


async def list_users(
    q: str | None,
    status: str | None,
    team_id: str | None,
    skip: int,
    limit: int,
) -> tuple[list[dict], int]:
    filt: dict = {"is_deleted": {"$ne": True}, **users_repo.search_filter(q)}
    if status:
        if status not in ("active", "inactive"):
            raise Unprocessable("status must be 'active' or 'inactive'", code="INVALID_STATUS")
        filt["status"] = status
    if team_id:
        if not ObjectId.is_valid(team_id):
            raise Unprocessable("Invalid team id", code="INVALID_TEAM")
        filt["professional.team_ids"] = ObjectId(team_id)
    total = await users_repo.count(filt)
    rows = await users_repo.find(filt, sort=[("employee_id", 1)], skip=skip, limit=limit)
    return rows, total


async def update_user(actor: dict, ident: str, data: UserUpdate) -> dict:
    user = await get_user(ident)
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise Unprocessable("No fields to update", code="NO_CHANGES")
    for key in ("full_name", "joining_date", "team_ids", "status"):
        if key in changes and changes[key] is None:
            raise Unprocessable(f"{key} cannot be null", code="INVALID_FIELD", details={"field": key})

    sets: dict = {}
    if "full_name" in changes:
        sets["personal.full_name"] = changes["full_name"].strip()
    if "phone" in changes:
        sets["personal.phone"] = changes["phone"]
    if "joining_date" in changes:
        sets["professional.joining_date"] = changes["joining_date"].isoformat()
    if "team_ids" in changes:
        sets["professional.team_ids"] = await _resolve_teams(changes["team_ids"])
    deactivating = False
    if "status" in changes:
        if user["role"] == "admin" and changes["status"] != "active":
            raise Forbidden("The administrator account cannot be deactivated")
        sets["status"] = changes["status"]
        deactivating = changes["status"] == "inactive" and user.get("status") != "inactive"

    update: dict = {"$set": sets}
    if deactivating:
        update["$inc"] = {"token_version": 1}  # kills live access tokens immediately

    async def _tx(session):
        updated = await users_repo.update(
            {"_id": user["_id"], "is_deleted": {"$ne": True}}, update, session=session
        )
        if updated is None:
            raise NotFound("User not found", code="USER_NOT_FOUND")
        await log_audit(actor["_id"], "user.updated", "user", user["_id"],
                        before=user, after=updated, session=session)
        return updated

    updated = await run_txn(_tx)
    if deactivating:
        await refresh_tokens_repo.revoke_all_for_user(user["_id"])
    return updated


async def delete_user(actor: dict, ident: str) -> None:
    """Soft delete. Email and employee code stay reserved by the unique indexes."""
    user = await get_user(ident)
    if user["role"] == "admin":
        raise Forbidden("The administrator account cannot be deleted")

    async def _tx(session):
        updated = await users_repo.update(
            {"_id": user["_id"], "is_deleted": {"$ne": True}},
            {
                "$set": {"is_deleted": True, "status": "inactive", "deleted_at": utcnow()},
                "$inc": {"token_version": 1},
            },
            session=session,
        )
        if updated is None:
            raise NotFound("User not found", code="USER_NOT_FOUND")
        await log_audit(actor["_id"], "user.deleted", "user", user["_id"], before=user, session=session)

    await run_txn(_tx)
    await refresh_tokens_repo.revoke_all_for_user(user["_id"])


async def send_warning_email(ident: str, payload: WarningEmailRequest) -> None:
    from app.core.errors import AppError
    from app.services.email import send_email

    user = await get_user(ident)
    name = user["personal"]["full_name"]
    email = user["work_email"]
    
    start_str = payload.week_start.strftime("%B %d, %Y")
    end_str = payload.week_end.strftime("%B %d, %Y")
    
    # Generate the text body
    text_body = f"""Dear {name},
    
This is an automated notice from the Attendance Management System. Our records indicate that your attendance for the week of {start_str} to {end_str} did not meet the company's attendance policy requirements.

Your Attendance Statistics
- Office Days: {payload.office_days_attended} (Required: >= {payload.office_days_required})
- Total Working Hours: {payload.total_hours_attended:.2f} h (Required: >= {payload.total_hours_required:.2f} h)
- Average Hours / Day: {payload.avg_hours_attended:.2f} h (Required: >= {payload.avg_hours_required:.2f} h)

Violation Reasons
"""
    for reason in payload.violation_reasons:
        text_body += f"- {reason}\n"
        
    text_body += """
Please discuss this with your manager. Repeated non-compliance may result in a formal HR review.

This message was sent automatically. Please do not reply."""

    # Generate the HTML body
    html_body = f"""
    <div style="font-family: sans-serif; color: #333;">
        <p>Dear <strong>{name}</strong>,</p>
        <p>This is an automated notice from the Attendance Management System. Our records indicate that your attendance for the week of <strong>{start_str}</strong> to <strong>{end_str}</strong> did not meet the company's attendance policy requirements.</p>
        
        <h3>Your Attendance Statistics</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px; text-align: left;">
            <thead style="background-color: #f9f9f9;">
                <tr>
                    <th>Metric</th>
                    <th>Your Value</th>
                    <th>Required</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Office Days</td>
                    <td>{payload.office_days_attended}</td>
                    <td>&ge; {payload.office_days_required}</td>
                </tr>
                <tr>
                    <td>Total Working Hours</td>
                    <td>{payload.total_hours_attended:.2f} h</td>
                    <td>&ge; {payload.total_hours_required:.2f} h</td>
                </tr>
                <tr>
                    <td>Average Hours / Day</td>
                    <td>{payload.avg_hours_attended:.2f} h</td>
                    <td>&ge; {payload.avg_hours_required:.2f} h</td>
                </tr>
            </tbody>
        </table>

        <h3>Violation Reasons</h3>
        <ul>
            {"".join(f"<li>{html.escape(reason)}</li>" for reason in payload.violation_reasons)}
        </ul>

        <p>Please discuss this with your manager. Repeated non-compliance may result in a formal HR review.</p>
        <br/>
        <p style="font-size: 0.85em; color: #888;">This message was sent automatically. Please do not reply.</p>
    </div>
    """

    success = await send_email(
        to=email,
        subject="Attendance Policy Warning",
        body=text_body,
        html_body=html_body
    )
    if not success:
        raise AppError("Failed to send warning email", status_code=500, code="INTERNAL_ERROR")
