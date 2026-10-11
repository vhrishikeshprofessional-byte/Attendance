"""FastAPI application entrypoint. Run: uvicorn app.main:app --reload"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import settings
from app.core.errors import install_error_handlers
from app.core.logging import setup_logging
from app.core.middleware import RequestContextMiddleware
from app.db.client import close_client, get_client, init_client
from app.db.indexes import ensure_indexes
from app.db.seed import ensure_admin
from app.jobs.scheduler import start_scheduler, stop_scheduler

log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_logging(settings.LOG_LEVEL)
    init_client()
    await ensure_indexes()
    await ensure_admin()
    start_scheduler()
    log.info("startup complete")
    try:
        yield
    finally:
        stop_scheduler()
        await close_client()


def create_app() -> FastAPI:
    is_local = settings.APP_ENV in ("local", "test")
    app = FastAPI(
        title="Attendance Management System",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if is_local else None,
        redoc_url=None,
        openapi_url="/openapi.json" if is_local else None,
    )
    install_error_handlers(app)

    if settings.cors_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_list,
            allow_credentials=False,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
            expose_headers=["X-Request-ID", "Retry-After"],
        )
    app.add_middleware(RequestContextMiddleware)  # added last = outermost

    app.include_router(api_router)

    @app.get("/health", tags=["health"])
    async def health():
        return {"status": "ok"}

    @app.get("/health/ready", tags=["health"])
    async def ready():
        await get_client().admin.command("ping")
        return {"status": "ready"}

    return app


app = create_app()
