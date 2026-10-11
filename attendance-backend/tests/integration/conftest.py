import pytest_asyncio

from tests.helpers import API


@pytest_asyncio.fixture
async def add_session(client, admin_headers):
    """Admin adds a manual session for an employee code / id."""

    async def _add(employee, entry, exit_, note=None, expect=201):
        r = await client.post(
            f"{API}/attendance/manual",
            headers=admin_headers,
            json={"employee": employee, "entry_time": entry, "exit_time": exit_, "note": note},
        )
        assert r.status_code == expect, r.text
        return r.json()

    return _add
