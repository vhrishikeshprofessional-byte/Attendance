"""Aggregates all v1 routers. Later batches add their routers here."""
from fastapi import APIRouter

from app.api.v1 import (
    attendance,
    audit_logs,
    auth,
    change_requests,
    holidays,
    reports,
    teams,
    users,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(teams.router)
api_router.include_router(holidays.router)
api_router.include_router(attendance.router)
api_router.include_router(change_requests.router)
api_router.include_router(reports.router)
api_router.include_router(audit_logs.router)
