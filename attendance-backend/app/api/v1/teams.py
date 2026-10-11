"""Team endpoints. Any signed-in user can read; only the admin can change."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import AdminUser, CurrentUser
from app.models.auth import MessageOut
from app.models.teams import TeamCreate, TeamMembers, TeamUpdate
from app.services import teams as svc
from app.services.users import PRIVATE_FIELDS
from app.utils.pagination import Page, page_meta
from app.utils.serialize import doc_out

router = APIRouter(prefix="/teams", tags=["teams"])


def _out(team: dict, count: int | None = None) -> dict:
    out = doc_out(team)
    if count is not None:
        out["member_count"] = count
    return out


@router.post("", status_code=201)
async def create_team(body: TeamCreate, admin: AdminUser):
    return _out(await svc.create_team(admin, body), 0)


@router.get("")
async def list_teams(
    user: CurrentUser,
    page: Page = Depends(),
    q: str | None = Query(None, max_length=80),
):
    rows, total = await svc.list_teams(q, page.skip, page.page_size)
    counts = await svc.member_counts([row["_id"] for row in rows])
    return {
        "items": [_out(row, counts.get(row["_id"], 0)) for row in rows],
        "meta": page_meta(page, total),
    }


@router.get("/{team_id}")
async def get_team(team_id: str, user: CurrentUser):
    team = await svc.get_team(team_id)
    counts = await svc.member_counts([team["_id"]])
    return _out(team, counts.get(team["_id"], 0))


@router.patch("/{team_id}")
async def update_team(team_id: str, body: TeamUpdate, admin: AdminUser):
    team = await svc.update_team(admin, team_id, body)
    counts = await svc.member_counts([team["_id"]])
    return _out(team, counts.get(team["_id"], 0))


@router.delete("/{team_id}", response_model=MessageOut)
async def delete_team(team_id: str, admin: AdminUser):
    await svc.delete_team(admin, team_id)
    return {"message": "Team deleted"}


@router.get("/{team_id}/members")
async def team_members(team_id: str, admin: AdminUser, page: Page = Depends()):
    rows, total = await svc.list_members(team_id, page.skip, page.page_size)
    return {
        "items": [doc_out(row, drop=PRIVATE_FIELDS) for row in rows],
        "meta": page_meta(page, total),
    }

@router.put("/{team_id}/members")
async def update_team_members(team_id: str, body: TeamMembers, admin: AdminUser):
    team = await svc.set_members(admin, team_id, body.member_ids)
    counts = await svc.member_counts([team["_id"]])
    return _out(team, counts.get(team["_id"], 0))
