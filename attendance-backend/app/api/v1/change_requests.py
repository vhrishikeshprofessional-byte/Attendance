"""Change-request endpoints. Employees create/cancel their own; admins decide."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import AdminUser, CurrentUser
from app.models.change_requests import ApproveIn, ChangeRequestCreate, RejectIn
from app.services import change_requests as svc
from app.utils.pagination import Page, page_meta
from app.utils.serialize import doc_out
from app.utils.timefmt import dt_fields

router = APIRouter(prefix="/change-requests", tags=["change-requests"])


def _out(doc: dict) -> dict:
    out = doc_out(doc)
    for key in ("proposed", "original"):
        part = doc.get(key)
        if part:
            out[key] = {}
            for field in ("entry_time", "exit_time"):
                if field in part:
                    out[key].update(dt_fields(field, part[field]))
    return out


@router.post("", status_code=201)
async def create_request(body: ChangeRequestCreate, user: CurrentUser):
    return _out(await svc.create_request(user, body))


@router.get("/me")
async def my_requests(
    user: CurrentUser,
    page: Page = Depends(),
    status: str | None = Query(None),
):
    rows, total = await svc.list_requests(
        requester_id=user["_id"],
        status=status,
        skip=page.skip,
        limit=page.page_size,
    )
    rows = await svc.attach_requesters(rows)
    return {"items": [_out(row) for row in rows], "meta": page_meta(page, total)}


@router.get("")
async def list_requests(
    admin: AdminUser,
    page: Page = Depends(),
    status: str | None = Query(None),
    employee: str | None = Query(None, min_length=1, max_length=64),
):
    rows, total = await svc.list_requests(
        employee=employee,
        status=status,
        skip=page.skip,
        limit=page.page_size,
    )
    rows = await svc.attach_requesters(rows)
    return {"items": [_out(row) for row in rows], "meta": page_meta(page, total)}


@router.get("/{request_id}")
async def get_request(request_id: str, user: CurrentUser):
    request = await svc.get_request_for(user, request_id)
    enriched = (await svc.attach_requesters([request]))[0]
    return _out(enriched)


@router.post("/{request_id}/approve")
async def approve_request(
    request_id: str, admin: AdminUser, body: ApproveIn | None = None
):
    return _out(await svc.approve(admin, request_id, body.note if body else None))


@router.post("/{request_id}/reject")
async def reject_request(request_id: str, body: RejectIn, admin: AdminUser):
    return _out(await svc.reject(admin, request_id, body.note))


@router.post("/{request_id}/cancel")
async def cancel_request(request_id: str, user: CurrentUser):
    return _out(await svc.cancel(user, request_id))
