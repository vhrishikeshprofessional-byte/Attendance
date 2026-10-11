from app.repositories.base import BaseRepo


class RefreshTokensRepo(BaseRepo):
    name = "refresh_tokens"

    async def revoke_family(self, family_id: str) -> None:
        await self.col.update_many({"family_id": family_id, "revoked": False}, {"$set": {"revoked": True}})

    async def revoke_all_for_user(self, user_id) -> None:
        await self.col.update_many({"user_id": user_id, "revoked": False}, {"$set": {"revoked": True}})



refresh_tokens_repo = RefreshTokensRepo()
