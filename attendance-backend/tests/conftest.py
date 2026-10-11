"""Shared fixtures. Env is set before any app import so Settings loads deterministically."""
from __future__ import annotations

import os

os.environ.update(
    {
        "APP_ENV": "test",
        "SECRET_KEY": "test-secret-key-that-is-at-least-32-characters",
        "USE_TRANSACTIONS": "false",
        "RATE_LIMIT_ENABLED": "false",
        "SCHEDULER_ENABLED": "false",
        "SMTP_HOST": "",
        "ADMIN_EMAIL": "admin@kxn.com",
        "ADMIN_PASSWORD": "AdminPass123",
        "TIMEZONE": "Asia/Kolkata",
        "WEEKLY_OFF_DAYS": "5,6",
        "REQUIRED_DAYS": "3",
        "REQUIRED_HOURS_PER_DAY": "5",
        "MIN_ATTENDED_DAY_MINUTES": "60",
        "MAX_SESSION_HOURS": "16",
        "ALLOWED_SIGNUP_DOMAINS": "",
    }
)

import itertools

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app.core.rate_limit import reset_rate_limits
from app.db.client import close_client, get_db, init_client
from app.db.indexes import INDEXES
from app.db.seed import ensure_admin
from app.main import app

ADMIN_EMAIL = "admin@kxn.com"
ADMIN_PASSWORD = "AdminPass123"
EMPLOYEE_PASSWORD = "EmployeePass1"
_counter = itertools.count(1)


async def _create_indexes() -> None:
    """Create indexes one by one; skip options the mock backend cannot emulate."""
    db = get_db()
    for collection, specs in INDEXES.items():
        for keys, options in specs:
            try:
                await db[collection].create_index(keys, **options)
            except Exception:
                continue


@pytest_asyncio.fixture
async def db():
    init_client(AsyncMongoMockClient(tz_aware=True))
    reset_rate_limits()
    await _create_indexes()
    await ensure_admin()
    yield get_db()
    await close_client()


@pytest_asyncio.fixture
async def client(db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as test_client:
        yield test_client


async def login(client: AsyncClient, identifier: str, password: str) -> dict:
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": identifier, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()


def bearer(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest_asyncio.fixture
async def admin_headers(client):
    return bearer(await login(client, ADMIN_EMAIL, ADMIN_PASSWORD))


@pytest_asyncio.fixture
async def make_employee(client, admin_headers):
    """Factory: creates an employee via the API and returns user, headers, and password."""

    async def _make(**overrides) -> dict:
        number = next(_counter)
        body = {
            "work_email": f"emp{number}@kxn.com",
            "full_name": f"Employee {number}",
            "password": EMPLOYEE_PASSWORD,
            "joining_date": "2020-01-01",
        }
        body.update(overrides)
        response = await client.post(
            "/api/v1/users", json=body, headers=admin_headers
        )
        assert response.status_code == 201, response.text
        user = response.json()
        tokens = await login(client, body["work_email"], body["password"])
        return {
            "user": user,
            "headers": bearer(tokens),
            "password": body["password"],
        }

    return _make
