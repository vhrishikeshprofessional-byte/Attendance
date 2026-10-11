"""Team management use-cases."""
from __future__ import annotations

import re

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.core.errors import Conflict, NotFound, Unprocessable
from app.db.client import aggregate, run_txn, sess
from app.models.teams import TeamCreate, TeamUpdate
from app.repositories.teams import teams_repo
from app.repositories.users import users_repo
from app.services.audit import log_audit
from app.utils.timefmt import utcnow

NOT_DELETED = {"is_deleted": {"$ne": True}}


def _norm(name: str) -> str:
    return " ".join(name.split())


async def get_team(team_id: str) -> dict:
    if not ObjectId.is_valid(team_id):
        raise NotFound("Team not found", code="TEAM_NOT_FOUND")
    team = await teams_repo.get(ObjectId(team_id), **NOT_DELETED)
    if team is None:
        raise NotFound("Team not found", code="TEAM_NOT_FOUND")
    return team


async def member_counts(ids: list[ObjectId]) -> dict[ObjectId, int]:
    if not ids:
        return {}
    rows = await aggregate(
        users_repo.col,
        [
            {"$match": {"professional.team_ids": {"$in": ids}, **NOT_DELETED}},
            {"$unwind": "$professional.team_ids"},
            {"$match": {"professional.team_ids": {"$in": ids}}},
            {"$group": {"_id": "$professional.team_ids", "n": {"$sum": 1}}},
        ],
    )
    return {row["_id"]: row["n"] for row in rows}


async def _ensure_name_free(name_lower: str, exclude_id: ObjectId | None = None) -> None:
    filt: dict = {"name_lower": name_lower, **NOT_DELETED}
    if exclude_id is not None:
        filt["_id"] = {"$ne": exclude_id}
    if await teams_repo.find_one(filt):
        raise Conflict("A team with this name already exists", code="TEAM_NAME_TAKEN")


async def create_team(actor: dict, data: TeamCreate) -> dict:
    name = _norm(data.name)
    await _ensure_name_free(name.lower())
    doc = {
        "name": name,
        "name_lower": name.lower(),
        "description": data.description,
        "is_deleted": False,
        "version": 1,
    }

    async def _tx(session):
        try:
            team = await teams_repo.insert(doc, session=session)
        except DuplicateKeyError:
            raise Conflict("A team with this name already exists", code="TEAM_NAME_TAKEN")
        await log_audit(
            actor["_id"], "team.created", "team", team["_id"], after=team, session=session
        )
        return team

    return await run_txn(_tx)


async def list_teams(q: str | None, skip: int, limit: int) -> tuple[list[dict], int]:
    filt: dict = dict(NOT_DELETED)
    if q and q.strip():
        filt["name_lower"] = {"$regex": re.escape(q.strip().lower())}
    total = await teams_repo.count(filt)
    rows = await teams_repo.find(filt, sort=[("name_lower", 1)], skip=skip, limit=limit)
    return rows, total


async def update_team(actor: dict, team_id: str, data: TeamUpdate) -> dict:
    team = await get_team(team_id)
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise Unprocessable("No fields to update", code="NO_CHANGES")
    sets: dict = {}
    if "name" in changes:
        if changes["name"] is None:
            raise Unprocessable(
                "name cannot be null", code="INVALID_FIELD", details={"field": "name"}
            )
        name = _norm(changes["name"])
        await _ensure_name_free(name.lower(), exclude_id=team["_id"])
        sets["name"], sets["name_lower"] = name, name.lower()
    if "description" in changes:
        sets["description"] = changes["description"]

    async def _tx(session):
        try:
            updated = await teams_repo.update(
                {"_id": team["_id"], **NOT_DELETED}, {"$set": sets}, session=session
            )
        except DuplicateKeyError:
            raise Conflict("A team with this name already exists", code="TEAM_NAME_TAKEN")
        if updated is None:
            raise NotFound("Team not found", code="TEAM_NOT_FOUND")
        await log_audit(
            actor["_id"],
            "team.updated",
            "team",
            team["_id"],
            before=team,
            after=updated,
            session=session,
        )
        return updated

    return await run_txn(_tx)


async def delete_team(actor: dict, team_id: str) -> None:
    """Soft delete; the team is also removed from every member's team list."""
    team = await get_team(team_id)

    async def _tx(session):
        updated = await teams_repo.update(
            {"_id": team["_id"], **NOT_DELETED},
            {"$set": {"is_deleted": True, "deleted_at": utcnow()}},
            session=session,
        )
        if updated is None:
            raise NotFound("Team not found", code="TEAM_NOT_FOUND")
        await users_repo.col.update_many(
            {"professional.team_ids": team["_id"]},
            {
                "$pull": {"professional.team_ids": team["_id"]},
                "$set": {"updated_at": utcnow()},
                "$inc": {"version": 1},
            },
            **sess(session),
        )
        await log_audit(
            actor["_id"], "team.deleted", "team", team["_id"], before=team, session=session
        )

    await run_txn(_tx)


async def list_members(team_id: str, skip: int, limit: int) -> tuple[list[dict], int]:
    team = await get_team(team_id)
    filt = {"professional.team_ids": team["_id"], **NOT_DELETED}
    total = await users_repo.count(filt)
    rows = await users_repo.find(filt, sort=[("employee_id", 1)], skip=skip, limit=limit)
    return rows, total

async def set_members(actor: dict, team_id: str, member_ids: list[str]) -> dict:
    team = await get_team(team_id)
    obj_ids = [ObjectId(mid) for mid in member_ids if ObjectId.is_valid(mid)]

    async def _tx(session):
        # Remove team from users who are no longer in the list
        await users_repo.col.update_many(
            {"professional.team_ids": team["_id"], "_id": {"$nin": obj_ids}, **NOT_DELETED},
            {
                "$pull": {"professional.team_ids": team["_id"]},
                "$set": {"updated_at": utcnow()},
                "$inc": {"version": 1},
            },
            **sess(session),
        )
        
        # Add team to users who are now in the list
        if obj_ids:
            await users_repo.col.update_many(
                {"_id": {"$in": obj_ids}, "professional.team_ids": {"$ne": team["_id"]}, **NOT_DELETED},
                {
                    "$addToSet": {"professional.team_ids": team["_id"]},
                    "$set": {"updated_at": utcnow()},
                    "$inc": {"version": 1},
                },
                **sess(session),
            )
            
        await log_audit(
            actor["_id"],
            "team.members_updated",
            "team",
            team["_id"],
            meta={"member_count": len(obj_ids)},
            session=session,
        )
        return team

    return await run_txn(_tx)
