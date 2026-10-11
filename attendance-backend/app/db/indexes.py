"""All index definitions (section 5.8 of the design)."""
from __future__ import annotations

import logging

from pymongo import ASCENDING as ASC
from pymongo import DESCENDING as DESC

from app.db.client import get_db

log = logging.getLogger("app.db")
NOT_DELETED = {"is_deleted": False}

INDEXES: dict[str, list[tuple[list, dict]]] = {
    "users": [
        ([("work_email", ASC)], {"unique": True, "name": "uniq_work_email"}),
        ([("employee_id", ASC)], {"unique": True, "name": "uniq_employee_id"}),
        ([("role", ASC)], {"unique": True, "name": "uniq_single_admin", "partialFilterExpression": {"role": "admin"}}),
        ([("professional.team_ids", ASC)], {"name": "team_ids"}),
        ([("status", ASC), ("professional.joining_date", ASC)], {"name": "status_joining"}),
    ],
    "attendance": [
        ([("employee_id", ASC), ("date", ASC), ("entry_time", ASC)],
         {"name": "emp_date_entry", "partialFilterExpression": NOT_DELETED}),
        ([("date", ASC), ("employee_id", ASC)], {"name": "date_emp", "partialFilterExpression": NOT_DELETED}),
        ([("week_start", ASC), ("employee_id", ASC)], {"name": "week_emp", "partialFilterExpression": NOT_DELETED}),
        ([("employee_id", ASC)], {"unique": True, "name": "uniq_open_session",
                                  "partialFilterExpression": {"is_open": True, "is_deleted": False}}),
    ],
    "teams": [
        ([("name_lower", ASC)], {"unique": True, "name": "uniq_team_name", "partialFilterExpression": NOT_DELETED}),
    ],
    "holidays": [([("date", ASC)], {"unique": True, "name": "uniq_holiday_date"})],
    "change_requests": [
        ([("status", ASC), ("created_at", DESC)], {"name": "status_created"}),
        ([("requester_id", ASC), ("created_at", DESC)], {"name": "requester_created"}),
        ([("target.id", ASC)], {"unique": True, "name": "uniq_pending_per_target",
                                "partialFilterExpression": {"status": "pending"}}),
    ],
    "audit_logs": [
        ([("entity.id", ASC), ("ts", DESC)], {"name": "entity_ts"}),
        ([("actor_id", ASC), ("ts", DESC)], {"name": "actor_ts"}),
        ([("ts", DESC)], {"name": "ts"}),
    ],
    "refresh_tokens": [
        ([("expires_at", ASC)], {"expireAfterSeconds": 0, "name": "ttl_expires"}),
        ([("token_hash", ASC)], {"unique": True, "name": "uniq_token_hash"}),
        ([("family_id", ASC)], {"name": "family"}),
        ([("user_id", ASC)], {"name": "user"}),
    ],
    "password_resets": [
        ([("expires_at", ASC)], {"expireAfterSeconds": 0, "name": "ttl_expires"}),
        ([("token_hash", ASC)], {"unique": True, "name": "uniq_token_hash"}),
    ],
    "notification_log": [
        ([("employee_id", ASC), ("week_start", ASC), ("type", ASC)], {"unique": True, "name": "uniq_notification"}),
    ],
}


async def ensure_indexes() -> None:
    db = get_db()
    for coll, specs in INDEXES.items():
        for keys, opts in specs:
            await db[coll].create_index(keys, **opts)
    log.info("indexes ensured")
