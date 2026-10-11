from app.repositories.base import BaseRepo


class NotificationLogRepo(BaseRepo):
    name = "notification_log"


notification_log_repo = NotificationLogRepo()
