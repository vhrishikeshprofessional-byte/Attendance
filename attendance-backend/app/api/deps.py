"""FastAPI dependencies: authentication and role checks."""
from __future__ import annotations

from typing import Annotated

from bson import ObjectId
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import Forbidden, Unauthorized
from app.core.security import decode_access_token
from app.repositories.users import users_repo

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict:
    if creds is None or creds.scheme.lower() != "bearer":
        raise Unauthorized(
            "Authentication required",
            code="NOT_AUTHENTICATED",
            headers={"WWW-Authenticate": "Bearer"},
        )
    claims = decode_access_token(creds.credentials)
    try:
        uid = ObjectId(claims["sub"])
    except Exception:
        raise Unauthorized("Invalid or expired token", code="INVALID_TOKEN") from None
    user = await users_repo.find_one({"_id": uid, "is_deleted": {"$ne": True}})
    if user is None or user.get("status") != "active":
        raise Unauthorized("Account is not active", code="INACTIVE_ACCOUNT")
    if int(claims.get("tv", 0)) != int(user.get("token_version", 0)):
        raise Unauthorized("Session has been revoked", code="TOKEN_REVOKED")
    return user


def require_roles(*roles: str):
    allowed = frozenset(roles)

    async def _dep(user: Annotated[dict, Depends(get_current_user)]) -> dict:
        if user.get("role") not in allowed:
            raise Forbidden("You do not have permission to perform this action")
        return user

    return _dep


CurrentUser = Annotated[dict, Depends(get_current_user)]
AdminUser = Annotated[dict, Depends(require_roles("admin"))]
