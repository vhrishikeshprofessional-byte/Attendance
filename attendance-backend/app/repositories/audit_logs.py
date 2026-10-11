from app.repositories.base import BaseRepo


class AuditLogsRepo(BaseRepo):
    name = "audit_logs"


audit_logs_repo = AuditLogsRepo()
