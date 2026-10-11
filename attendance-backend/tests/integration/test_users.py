from unittest.mock import AsyncMock

import pytest

from tests.conftest import EMPLOYEE_PASSWORD, login
from tests.helpers import API

WARNING = {
    "week_start": "2026-10-05", "week_end": "2026-10-11",
    "office_days_attended": 1, "office_days_required": 3,
    "total_hours_attended": 5.5, "total_hours_required": 15,
    "avg_hours_attended": 5.5, "avg_hours_required": 5,
    "violation_reasons": ["Not enough office days"],
}


async def test_admin_creates_user(client, admin_headers):
    r = await client.post(f"{API}/users", headers=admin_headers, json={
        "work_email": "New.Hire@kxn.com", "full_name": " New Hire ", "password": EMPLOYEE_PASSWORD,
        "joining_date": "2026-01-05", "phone": "+91 98765 43210",
    })
    assert r.status_code == 201, r.text
    u = r.json()
    assert u["work_email"] == "new.hire@kxn.com" and u["role"] == "employee" and u["status"] == "active"
    assert u["employee_id"].startswith("EMP-") and u["personal"]["full_name"] == "New Hire"
    assert u["professional"]["joining_date"] == "2026-01-05"
    assert "password_hash" not in u and "token_version" not in u
    await login(client, "new.hire@kxn.com", EMPLOYEE_PASSWORD)


async def test_create_user_validation(client, admin_headers, make_employee):
    emp = await make_employee()
    base = {"work_email": "v@kxn.com", "full_name": "V", "password": EMPLOYEE_PASSWORD}
    assert (await client.post(f"{API}/users", headers=admin_headers, json={**base, "work_email": emp["user"]["work_email"]})).status_code == 409
    assert (await client.post(f"{API}/users", headers=admin_headers, json={**base, "password": "weak"})).json()["error"]["code"] == "WEAK_PASSWORD"
    r = await client.post(f"{API}/users", headers=admin_headers, json={**base, "team_ids": ["not-an-id"]})
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_TEAM"
    r = await client.post(f"{API}/users", headers=admin_headers, json={**base, "team_ids": ["64b7f0f0f0f0f0f0f0f0f0f0"]})
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_TEAM"
    assert (await client.post(f"{API}/users", headers=admin_headers, json={**base, "phone": "abc"})).status_code == 422
    assert (await client.post(f"{API}/users", headers=admin_headers, json={**base, "role": "admin"})).status_code == 422


async def test_create_user_with_teams(client, admin_headers):
    team = (await client.post(f"{API}/teams", headers=admin_headers, json={"name": "Platform"})).json()
    r = await client.post(f"{API}/users", headers=admin_headers, json={
        "work_email": "t@kxn.com", "full_name": "T", "password": EMPLOYEE_PASSWORD, "team_ids": [team["id"], team["id"]]})
    assert r.json()["professional"]["team_ids"] == [team["id"]]  # de-duplicated


async def test_employee_cannot_use_admin_user_endpoints(client, make_employee):
    emp = await make_employee()
    h = emp["headers"]
    assert (await client.get(f"{API}/users", headers=h)).status_code == 403
    assert (await client.post(f"{API}/users", headers=h, json={})).status_code in (403, 422)
    assert (await client.patch(f"{API}/users/{emp['user']['id']}", headers=h, json={"full_name": "X"})).status_code == 403
    assert (await client.delete(f"{API}/users/{emp['user']['id']}", headers=h)).status_code == 403
    assert (await client.post(f"{API}/users/{emp['user']['id']}/warning", headers=h, json=WARNING)).status_code == 403


async def test_profile_visibility(client, admin_headers, make_employee):
    a, b = await make_employee(), await make_employee()
    assert (await client.get(f"{API}/users/{a['user']['id']}", headers=a["headers"])).status_code == 200
    r = await client.get(f"{API}/users/{b['user']['id']}", headers=a["headers"])
    assert r.status_code == 403
    assert (await client.get(f"{API}/users/{a['user']['employee_id']}", headers=admin_headers)).status_code == 200
    assert (await client.get(f"{API}/users/{a['user']['employee_id'].lower()}", headers=admin_headers)).status_code == 200
    r = await client.get(f"{API}/users/EMP-999999", headers=admin_headers)
    assert r.status_code == 404 and r.json()["error"]["code"] == "USER_NOT_FOUND"


async def test_list_search_filter_and_pagination(client, admin_headers, make_employee):
    a = await make_employee(full_name="Zed Unique")
    await make_employee()
    await make_employee()
    r = await client.get(f"{API}/users", headers=admin_headers, params={"q": "zed unique"})
    assert [u["id"] for u in r.json()["items"]] == [a["user"]["id"]]
    r = await client.get(f"{API}/users", headers=admin_headers, params={"q": a["user"]["work_email"][:6]})
    assert any(u["id"] == a["user"]["id"] for u in r.json()["items"])
    r = await client.get(f"{API}/users", headers=admin_headers, params={"page": 2, "page_size": 2})
    assert r.json()["meta"] == {"page": 2, "page_size": 2, "total": 4} and len(r.json()["items"]) == 2  # admin + 3 employees
    assert (await client.get(f"{API}/users", headers=admin_headers, params={"status": "weird"})).json()["error"]["code"] == "INVALID_STATUS"
    assert (await client.get(f"{API}/users", headers=admin_headers, params={"team_id": "bad"})).json()["error"]["code"] == "INVALID_TEAM"
    assert (await client.get(f"{API}/users", headers=admin_headers, params={"page_size": 500})).status_code == 422
    # regex characters in the search must be treated literally
    assert (await client.get(f"{API}/users", headers=admin_headers, params={"q": ".*"})).json()["items"] == []


async def test_update_user(client, admin_headers, make_employee):
    emp = await make_employee()
    uid = emp["user"]["id"]
    r = await client.patch(f"{API}/users/{uid}", headers=admin_headers, json={"full_name": "Renamed", "phone": "+91 90000 00000", "joining_date": "2024-02-01"})
    assert r.status_code == 200
    u = r.json()
    assert u["personal"]["full_name"] == "Renamed" and u["professional"]["joining_date"] == "2024-02-01" and u["version"] == 2
    cleared = await client.patch(f"{API}/users/{uid}", headers=admin_headers, json={"phone": None})
    assert cleared.json()["personal"]["phone"] is None


@pytest.mark.parametrize("body,code", [
    ({}, "NO_CHANGES"),
    ({"full_name": None}, "INVALID_FIELD"),
    ({"status": None}, "INVALID_FIELD"),
])
async def test_update_user_rejects_empty_or_null(client, admin_headers, make_employee, body, code):
    emp = await make_employee()
    r = await client.patch(f"{API}/users/{emp['user']['id']}", headers=admin_headers, json=body)
    assert r.status_code == 422 and r.json()["error"]["code"] == code


async def test_update_user_rejects_bad_values(client, admin_headers, make_employee):
    emp = await make_employee()
    url = f"{API}/users/{emp['user']['id']}"
    assert (await client.patch(url, headers=admin_headers, json={"status": "banned"})).status_code == 422
    assert (await client.patch(url, headers=admin_headers, json={"email": "x@y.com"})).status_code == 422
    assert (await client.patch(url, headers=admin_headers, json={"team_ids": ["bad"]})).json()["error"]["code"] == "INVALID_TEAM"


async def test_admin_cannot_be_deactivated_or_deleted(client, admin_headers):
    r = await client.patch(f"{API}/users/ADMIN", headers=admin_headers, json={"status": "inactive"})
    assert r.status_code == 403
    assert (await client.delete(f"{API}/users/ADMIN", headers=admin_headers)).status_code == 403


async def test_deactivate_then_reactivate(client, admin_headers, make_employee):
    emp = await make_employee()
    url = f"{API}/users/{emp['user']['id']}"
    await client.patch(url, headers=admin_headers, json={"status": "inactive"})
    assert (await client.get(f"{API}/auth/me", headers=emp["headers"])).status_code == 401
    await client.patch(url, headers=admin_headers, json={"status": "active"})
    await login(client, emp["user"]["work_email"], emp["password"])
    inactive = (await client.get(f"{API}/users", headers=admin_headers, params={"status": "inactive"})).json()["items"]
    assert inactive == []


async def test_delete_user_is_soft_and_reserves_identity(client, admin_headers, make_employee):
    emp = await make_employee()
    url = f"{API}/users/{emp['user']['id']}"
    assert (await client.delete(url, headers=admin_headers)).status_code == 200
    assert (await client.get(url, headers=admin_headers)).status_code == 404
    assert (await client.get(f"{API}/auth/me", headers=emp["headers"])).status_code == 401
    r = await client.post(f"{API}/auth/login", json={"identifier": emp["user"]["work_email"], "password": emp["password"]})
    assert r.status_code == 401
    ids = [u["id"] for u in (await client.get(f"{API}/users", headers=admin_headers)).json()["items"]]
    assert emp["user"]["id"] not in ids
    again = await client.post(f"{API}/users", headers=admin_headers, json={
        "work_email": emp["user"]["work_email"], "full_name": "Re", "password": EMPLOYEE_PASSWORD})
    assert again.status_code == 409


async def test_warning_email_sent(client, admin_headers, make_employee, monkeypatch):
    emp = await make_employee()
    send = AsyncMock(return_value=True)
    monkeypatch.setattr("app.services.email.send_email", send)
    r = await client.post(f"{API}/users/{emp['user']['id']}/warning", headers=admin_headers, json=WARNING)
    assert r.status_code == 200
    kw = send.call_args.kwargs
    assert kw["to"] == emp["user"]["work_email"] and kw["subject"] == "Attendance Policy Warning"
    assert "Not enough office days" in kw["body"] and "October 05, 2026" in kw["body"]
    assert "Not enough office days" in kw["html_body"]


async def test_warning_email_failure_surfaces_500(client, admin_headers, make_employee):
    emp = await make_employee()  # SMTP_HOST is empty in tests -> send_email returns False
    r = await client.post(f"{API}/users/{emp['user']['id']}/warning", headers=admin_headers, json=WARNING)
    assert r.status_code == 500 and r.json()["error"]["code"] == "INTERNAL_ERROR"


async def test_warning_payload_validation(client, admin_headers, make_employee):
    emp = await make_employee()
    r = await client.post(f"{API}/users/{emp['user']['id']}/warning", headers=admin_headers, json={"week_start": "bad"})
    assert r.status_code == 422


async def test_warning_email_html_is_escaped(client, admin_headers, make_employee, monkeypatch):
    emp = await make_employee()
    send = AsyncMock(return_value=True)
    monkeypatch.setattr("app.services.email.send_email", send)
    payload = {**WARNING, "violation_reasons": ["<script>alert(1)</script>"]}
    await client.post(f"{API}/users/{emp['user']['id']}/warning", headers=admin_headers, json=payload)
    assert "<script>" not in send.call_args.kwargs["html_body"]
