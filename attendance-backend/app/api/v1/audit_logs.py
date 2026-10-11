"""Audit log endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import AdminUser
from app.services import audit as svc
from app.utils.pagination import Page, page_meta
from app.utils.serialize import doc_out

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("")
async def list_logs(
    admin: AdminUser,
    page: Page = Depends(),
    q: str | None = Query(None),
):
    rows, total = await svc.list_logs(
        action=q if q else None,
        skip=page.skip,
        limit=page.page_size,
    )
    return {"items": [doc_out(row) for row in rows], "meta": page_meta(page, total)}
