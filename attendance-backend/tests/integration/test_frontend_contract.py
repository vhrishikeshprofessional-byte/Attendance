from tests.conftest import EMPLOYEE_PASSWORD
from tests.helpers import API, ist

DAY = "2025-01-06"


async def test_employee_dialog_create_payload_is_rejected(client, admin_headers):
    # EmployeeDialog sends status='active' and phone='' -> UserCreate forbids extras and validates phone
    base = {"full_name": "A", "work_email": "ui@kxn.com", "password": EMPLOYEE_PASSWORD}
    assert (await client.post(f"{API}/users", headers=admin_headers, json={**base, "phone": "", "status": "active"})).status_code == 422
    assert (await client.post(f"{API}/users", headers=admin_headers, json={**base, "status": "active"})).status_code == 422
    assert (await client.post(f"{API}/users", headers=admin_headers, json={**base, "phone": ""})).status_code == 422
    assert (await client.post(f"{API}/users", headers=admin_headers, json=base)).status_code == 201


async def test_employee_dialog_update_payload_with_version_is_rejected(client, admin_headers, make_employee):
    emp = await make_employee()
    r = await client.patch(f"{API}/users/{emp['user']['id']}", headers=admin_headers,
                           json={"full_name": "X", "phone": "", "status": "active", "version": 1})
    assert r.status_code == 422


async def test_attendance_manager_add_without_exit_is_rejected(client, admin_headers, make_employee):
    emp = await make_employee()
    r = await client.post(f"{API}/attendance/manual", headers=admin_headers,
                          json={"employee": emp["user"]["employee_id"], "entry_time": "2025-01-06T09:00", "exit_time": None, "note": "n"})
    assert r.status_code == 422


async def test_attendance_manager_datetime_local_format_is_accepted(client, admin_headers, make_employee):
    emp = await make_employee()
    r = await client.post(f"{API}/attendance/manual", headers=admin_headers,
                          json={"employee": emp["user"]["employee_id"], "entry_time": "2025-01-06T09:00", "exit_time": "2025-01-06T14:00", "note": "n"})
    assert r.status_code == 201 and r.json()["entry_time_iso"] == "2025-01-06T03:30:00Z"


async def test_add_request_without_exit_is_rejected(client, make_employee):
    emp = await make_employee()
    r = await client.post(f"{API}/change-requests", headers=emp["headers"],
                          json={"action": "add", "entry_time": ist(DAY, "09:00"), "exit_time": None, "reason": "open session"})
    assert r.status_code == 422


async def test_endpoints_the_frontend_calls_but_backend_lacks(client, admin_headers):
    assert (await client.post(f"{API}/admin/policy/run", headers=admin_headers)).status_code == 404
    assert (await client.patch(f"{API}/auth/admin/credentials", headers=admin_headers, json={"current_password": "x"})).status_code in (404, 405)
    assert (await client.post(f"{API}/attendance/64b7f0f0f0f0f0f0f0f0f0f0/restore", headers=admin_headers)).status_code in (404, 405)


async def test_session_json_field_names(client, make_employee):
    emp = await make_employee()
    s = (await client.post(f"{API}/attendance/check-in", headers=emp["headers"])).json()
    # frontend types expect `open` and `duration_seconds`; backend exposes these instead:
    assert "is_open" in s and "duration_minutes" in s
    assert "open" not in s and "duration_seconds" not in s


async def test_weekly_report_field_names(client, make_employee):
    emp = await make_employee()
    w = (await client.get(f"{API}/reports/me/weekly", headers=emp["headers"])).json()["weeks"][0]
    # dashboards read status/total_hours/required_hours; backend exposes these instead:
    assert {"compliant", "counted_minutes", "required_minutes", "attended_days"} <= set(w)
    assert not ({"status", "total_hours", "required_hours"} & set(w))
