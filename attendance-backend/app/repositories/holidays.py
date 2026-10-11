from app.repositories.base import BaseRepo


class HolidaysRepo(BaseRepo):
    name = "holidays"


holidays_repo = HolidaysRepo()
