from app.repositories.base import BaseRepo


class ChangeRequestsRepo(BaseRepo):
    name = "change_requests"


change_requests_repo = ChangeRequestsRepo()
