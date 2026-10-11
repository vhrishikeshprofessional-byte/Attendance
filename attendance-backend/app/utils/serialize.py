"""JSON-safe conversion of Mongo documents."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from bson import ObjectId

from app.utils.timefmt import fmt_iso


def jsonable(v: Any) -> Any:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, datetime):
        return fmt_iso(v)
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, dict):
        return {k: jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [jsonable(x) for x in v]
    return v


def doc_out(doc: dict | None, drop: tuple[str, ...] = ()) -> dict | None:
    if doc is None:
        return None
    out = jsonable(doc)
    out["id"] = out.pop("_id")
    for k in drop:
        out.pop(k, None)
    return out
