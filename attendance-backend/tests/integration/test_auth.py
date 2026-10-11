import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_login_and_me(client: AsyncClient, admin_headers):
    # admin_headers fixture logs in using ADMIN_EMAIL and ADMIN_PASSWORD
    assert "Authorization" in admin_headers
    resp = await client.get("/api/v1/auth/me", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"

@pytest.mark.asyncio
async def test_employee_login_and_me(client: AsyncClient, make_employee):
    emp = await make_employee()
    resp = await client.get("/api/v1/auth/me", headers=emp["headers"])
    assert resp.status_code == 200
    assert resp.json()["role"] == "employee"

@pytest.mark.asyncio
async def test_employee_signup(client: AsyncClient):
    signup_data = {
        "work_email": "new_emp@kxn.com",
        "full_name": "New Employee",
        "password": "StrongPassword123"
    }
    resp = await client.post("/api/v1/auth/signup", json=signup_data)
    assert resp.status_code == 201, resp.text
    tokens = resp.json()
    assert "access_token" in tokens
    
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    me_resp = await client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["work_email"] == "new_emp@kxn.com"


