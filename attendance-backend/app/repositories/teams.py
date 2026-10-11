from app.repositories.base import BaseRepo


class TeamsRepo(BaseRepo):
    name = "teams"


teams_repo = TeamsRepo()
