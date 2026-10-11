from app.repositories.base import BaseRepo


class PasswordResetsRepo(BaseRepo):
    name = "password_resets"


password_resets_repo = PasswordResetsRepo()
