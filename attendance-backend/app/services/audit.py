"""Audit trail writer. Never store secrets in before/after snapshots."""
from __future__ import annotations

from typing import Any

from bson import ObjectId

from app.core.context import client_ip_var, request_id_var
from app.repositories.audit_logs import audit_logs_repo
from app.utils.timefmt import utcnow

_SENSITIVE = frozenset({"password_hash", "password", "token_hash", "token"})


def _scrub(v: Any) -> Any:
    if isinstance(v, dict):
        return {k: _scrub(x) for k, x in v.items() if k not in _SENSITIVE}
    if isinstance(v, (list, tuple)):
        return [_scrub(x) for x in v]
    return v


async def log_audit(
    actor_id: ObjectId | None,
    action: str,
    entity_type: str,
    entity_id: Any,
    *,
    before: dict | None = None,
    after: dict | None = None,
    meta: dict | None = None,
    session: Any = None,
) -> None:
    await audit_logs_repo.insert(
        {
            "ts": utcnow(),
            "actor_id": actor_id,
            "action": action,
            "entity": {"type": entity_type, "id": entity_id},
            "before": _scrub(before) if before is not None else None,
            "after": _scrub(after) if after is not None else None,
            "meta": _scrub(meta) if meta else None,
            "request_id": request_id_var.get(),
            "ip": client_ip_var.get(),
        },
        session=session,
    )

async def list_logs(
    actor_id: ObjectId | None = None,
    entity_type: str | None = None,
    action: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    filt = {}
    if actor_id:
        filt["actor_id"] = actor_id
    if entity_type:
        filt["entity.type"] = entity_type
    if action:
        import re
        filt["action"] = {"$regex": re.escape(action), "$options": "i"}

    total = await audit_logs_repo.count(filt)
    rows = await audit_logs_repo.find(filt, sort=[("ts", -1)], skip=skip, limit=limit)
    
    # Attach actor names
    from app.repositories.users import users_repo
    actor_ids = {r["actor_id"] for r in rows if r.get("actor_id")}
    actors = await users_repo.many_by_ids(list(actor_ids), projection={"personal.full_name": 1})
    for r in rows:
        actor = actors.get(r.get("actor_id"))
        if actor and actor.get("personal"):
            r["actor_name"] = actor["personal"].get("full_name")
            
    return rows, total
