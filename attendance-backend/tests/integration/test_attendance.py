import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_employee_check_in_out(client: AsyncClient, make_employee):
    emp = await make_employee()
    headers = emp["headers"]

    # Check in
    resp = await client.post("/api/v1/attendance/check-in", headers=headers)
    assert resp.status_code == 201
    assert resp.json()["is_open"] is True

    # Check out
    resp2 = await client.post("/api/v1/attendance/check-out", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["is_open"] is False

@pytest.mark.asyncio
async def test_admin_reports(client: AsyncClient, admin_headers):
    # Test getting users
    resp = await client.get("/api/v1/users", headers=admin_headers)
    assert resp.status_code == 200
    assert "items" in resp.json()

    # Test getting weekly overview reports
    resp = await client.get("/api/v1/reports/weekly-overview?week_start=2024-01-01", headers=admin_headers)
    assert resp.status_code == 200

