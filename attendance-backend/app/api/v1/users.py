"""User management endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import AdminUser, CurrentUser
from app.core.errors import Forbidden
from app.models.auth import MessageOut
from app.models.users import UserCreate, UserUpdate, WarningEmailRequest
from app.services import users as svc
from app.utils.pagination import Page, page_meta
from app.utils.serialize import doc_out

router = APIRouter(prefix="/users", tags=["users"])


def _out(doc: dict) -> dict:
    return doc_out(doc, drop=svc.PRIVATE_FIELDS)


@router.post("", status_code=201)
async def create_user(body: UserCreate, admin: AdminUser):
    return _out(await svc.create_user(admin, body))


@router.get("")
async def list_users(
    admin: AdminUser,
    page: Page = Depends(),
    q: str | None = Query(None, max_length=100),
    status: str | None = Query(None),
    team_id: str | None = Query(None),
):
    rows, total = await svc.list_users(q, status, team_id, page.skip, page.page_size)
    return {"items": [_out(row) for row in rows], "meta": page_meta(page, total)}


@router.get("/{ident}")
async def get_user(ident: str, user: CurrentUser):
    target = await svc.get_user(ident)
    if user["role"] != "admin" and target["_id"] != user["_id"]:
        raise Forbidden("You can only view your own profile")
    return _out(target)


@router.patch("/{ident}")
async def update_user(ident: str, body: UserUpdate, admin: AdminUser):
    return _out(await svc.update_user(admin, ident, body))


@router.delete("/{ident}", response_model=MessageOut)
async def delete_user(ident: str, admin: AdminUser):
    await svc.delete_user(admin, ident)
    return {"message": "User deleted"}


@router.post("/{ident}/warning", response_model=MessageOut)
async def send_warning_email(ident: str, body: WarningEmailRequest, admin: AdminUser):
    await svc.send_warning_email(ident, body)
    return {"message": "Warning email sent successfully"}
