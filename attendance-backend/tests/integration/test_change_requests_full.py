import pytest

from tests.helpers import API, ist

DAY = "2025-01-06"


async def _create(client, h, **body):
    return await client.post(f"{API}/change-requests", headers=h, json=body)


async def _sessions(client, admin_headers, emp):
    r = await client.get(f"{API}/attendance", headers=admin_headers,
                         params={"employee": emp["user"]["id"], "from_date": DAY, "to_date": "2025-01-12"})
    return r.json()["items"]


# ---------------- creation ----------------
async def test_create_add_request(client, make_employee):
    emp = await make_employee()
    r = await _create(client, emp["headers"], action="add", entry_time=ist(DAY, "09:00"), exit_time=ist(DAY, "14:00"), reason="Forgot to check in")
    assert r.status_code == 201, r.text
    cr = r.json()
    assert cr["status"] == "pending" and cr["action"] == "add" and cr["session_id"] is None
    assert cr["proposed"]["entry_time_iso"] == "2025-01-06T03:30:00Z"
    assert cr["proposed"]["exit_time"] == "January 6, 2025 2:00:00 PM"
    assert cr["target"]["id"] == cr["id"] and cr["requester_id"] == emp["user"]["id"]


@pytest.mark.parametrize("body", [
    {"action": "add", "entry_time": ist(DAY, "09:00"), "reason": "no exit"},
    {"action": "add", "entry_time": ist(DAY, "09:00"), "exit_time": ist(DAY, "10:00"), "session_id": "abc", "reason": "r r r"},
    {"action": "edit", "exit_time": ist(DAY, "10:00"), "reason": "no session"},
    {"action": "edit", "session_id": "abc", "reason": "no times"},
    {"action": "delete", "reason": "no session"},
    {"action": "delete", "session_id": "abc", "entry_time": ist(DAY, "09:00"), "reason": "times on delete"},
    {"action": "bogus", "reason": "bad action"},
    {"action": "delete", "session_id": "abc", "reason": "ab"},
    {"action": "delete", "session_id": "abc", "reason": "x" * 501},
    {"action": "delete", "session_id": "abc", "reason": "ok ok", "extra": 1},
])
async def test_create_shape_validation(client, make_employee, body):
    emp = await make_employee()
    assert (await _create(client, emp["headers"], **body)).status_code == 422


async def test_add_request_semantic_validation(client, add_session, make_employee):
    emp = await make_employee()
    h = emp["headers"]
    await add_session(emp["user"]["id"], ist(DAY, "09:00"), ist(DAY, "14:00"))
    r = await _create(client, h, action="add", entry_time=ist(DAY, "10:00"), exit_time=ist(DAY, "11:00"), reason="overlaps")
    assert r.status_code == 409 and r.json()["error"]["code"] == "OVERLAPPING_SESSION"
    r = await _create(client, h, action="add", entry_time=ist("2999-01-01", "10:00"), exit_time=ist("2999-01-01", "11:00"), reason="future")
    assert r.json()["error"]["code"] == "FUTURE_TIME"
    r = await _create(client, h, action="add", entry_time=ist(DAY, "20:00"), exit_time=ist(DAY, "19:00"), reason="backwards")
    assert r.json()["error"]["code"] == "EXIT_BEFORE_ENTRY"


async def test_cannot_request_changes_to_someone_elses_session(client, add_session, make_employee):
    a, b = await make_employee(), await make_employee()
    s = await add_session(a["user"]["id"], ist(DAY, "09:00"), ist(DAY, "14:00"))
    for action in ("delete", "edit"):
        extra = {"exit_time": ist(DAY, "15:00")} if action == "edit" else {}
        r = await _create(client, b["headers"], action=action, session_id=s["id"], reason="not mine", **extra)
        assert r.status_code == 404 and r.json()["error"]["code"] == "SESSION_NOT_FOUND"


async def test_edit_request_validation(client, add_session, make_employee):
    emp = await make_employee()
    s = await add_session(emp["user"]["id"], ist(DAY, "09:00"), ist(DAY, "14:00"))
    r = await _create(client, emp["headers"], action="edit", session_id=s["id"], exit_time=ist(DAY, "08:00"), reason="bad exit")
    assert r.json()["error"]["code"] == "EXIT_BEFORE_ENTRY"
    r = await _create(client, emp["headers"], action="edit", session_id="64b7f0f0f0f0f0f0f0f0f0f0", exit_time=ist(DAY, "15:00"), reason="ghost")
    assert r.status_code == 404


async def test_one_pending_request_per_session(client, db, add_session, make_employee):
    if "uniq_pending_per_target" not in await db.change_requests.index_information():
        pytest.skip("mock backend cannot create the partial unique index; run against real MongoDB")
    emp = await make_employee()
    s = await add_session(emp["user"]["id"], ist(DAY, "09:00"), ist(DAY, "14:00"))
    assert (await _create(client, emp["headers"], action="delete", session_id=s["id"], reason="first")).status_code == 201
    r = await _create(client, emp["headers"], action="delete", session_id=s["id"], reason="second")
    assert r.status_code == 409 and r.json()["error"]["code"] == "PENDING_REQUEST_EXISTS"


# ---------------- approve ----------------
async def test_approve_add_creates_session(client, admin_headers, make_employee):
    emp = await make_employee()
    cr = (await _create(client, emp["headers"], action="add", entry_time=ist(DAY, "09:00"), exit_time=ist(DAY, "14:00"), reason="Forgot")).json()
    r = await client.post(f"{API}/change-requests/{cr['id']}/approve", headers=admin_headers, json={"note": "ok"})
    assert r.status_code == 200
    done = r.json()
    assert done["status"] == "approved" and done["decision_note"] == "ok" and done["decided_by"] and done["decided_at"]
    s = (await _sessions(client, admin_headers, emp))
    assert len(s) == 1 and s[0]["source"] == "change_request" and s[0]["duration_minutes"] == 300 and s[0]["request_id"] == cr["id"]


async def test_approve_without_body(client, admin_headers, make_employee):
    emp = await make_employee()
    cr = (await _create(client, emp["headers"], action="add", entry_time=ist(DAY, "09:00"), exit_time=ist(DAY, "10:00"), reason="Forgot")).json()
    r = await client.post(f"{API}/change-requests/{cr['id']}/approve", headers=admin_headers)
    assert r.status_code == 200 and r.json()["status"] == "approved" and r.json()["decision_note"] is None


async def test_approve_edit_updates_session(client, admin_headers, add_session, make_employee):
    emp = await make_employee()
    s = await add_session(emp["user"]["id"], ist(DAY, "09:00"), ist(DAY, "14:00"))
    cr = (await _create(client, emp["headers"], action="edit", session_id=s["id"], exit_time=ist(DAY, "15:00"), reason="Left later")).json()
    assert cr["original"]["exit_time_iso"] == "2025-01-06T08:30:00Z" and cr["proposed"]["exit_time_iso"] == "2025-01-06T09:30:00Z"
    assert "entry_time" not in cr["proposed"]
    await client.post(f"{API}/change-requests/{cr['id']}/approve", headers=admin_headers)
    rows = await _sessions(client, admin_headers, emp)
    assert rows[0]["duration_minutes"] == 360 and rows[0]["entry_time_iso"] == "2025-01-06T03:30:00Z"


async def test_approve_delete_removes_session(client, admin_headers, add_session, make_employee):
    emp = await make_employee()
    s = await add_session(emp["user"]["id"], ist(DAY, "09:00"), ist(DAY, "14:00"))
    cr = (await _create(client, emp["headers"], action="delete", session_id=s["id"], reason="Wrong day")).json()
    await client.post(f"{API}/change-requests/{cr['id']}/approve", headers=admin_headers)
    assert await _sessions(client, admin_headers, emp) == []


async def test_approve_fails_when_target_vanished(client, admin_headers, add_session, make_employee):
    emp = await make_employee()
    s = await add_session(emp["user"]["id"], ist(DAY, "09:00"), ist(DAY, "14:00"))
    cr = (await _create(client, emp["headers"], action="delete", session_id=s["id"], reason="Wrong day")).json()
    await client.delete(f"{API}/attendance/{s['id']}", headers=admin_headers)
    r = await client.post(f"{API}/change-requests/{cr['id']}/approve", headers=admin_headers)
    assert r.status_code == 422 and r.json()["error"]["code"] == "SESSION_GONE"


async def test_approval_is_audited(client, admin_headers, make_employee):
    emp = await make_employee()
    cr = (await _create(client, emp["headers"], action="add", entry_time=ist(DAY, "09:00"), exit_time=ist(DAY, "10:00"), reason="Forgot")).json()
    await client.post(f"{API}/change-requests/{cr['id']}/approve", headers=admin_headers)
    actions = {l["action"] for l in (await client.get(f"{API}/audit-logs", headers=admin_headers, params={"page_size": 100})).json()["items"]}
    assert {"change_request.created", "change_request.approved", "attendance.created"} <= actions


# ---------------- reject / cancel / permissions ----------------
async def test_reject_requires_note_and_blocks_further_decisions(client, admin_headers, add_session, make_employee):
    emp = await make_employee()
    s = await add_session(emp["user"]["id"], ist(DAY, "09:00"), ist(DAY, "14:00"))
    cr = (await _create(client, emp["headers"], action="delete", session_id=s["id"], reason="Wrong day")).json()
    assert (await client.post(f"{API}/change-requests/{cr['id']}/reject", headers=admin_headers, json={})).status_code == 422
    assert (await client.post(f"{API}/change-requests/{cr['id']}/reject", headers=admin_headers, json={"note": "   "})).status_code == 422
    r = await client.post(f"{API}/change-requests/{cr['id']}/reject", headers=admin_headers, json={"note": "Not valid"})
    assert r.status_code == 200 and r.json()["status"] == "rejected" and r.json()["decision_note"] == "Not valid"
    assert len(await _sessions(client, admin_headers, emp)) == 1
    for path, body in (("approve", None), ("reject", {"note": "again"})):
        again = await client.post(f"{API}/change-requests/{cr['id']}/{path}", headers=admin_headers, json=body)
        assert again.status_code == 409 and again.json()["error"]["code"] == "REQUEST_NOT_PENDING"


async def test_requester_can_cancel_own_pending_request(client, admin_headers, make_employee):
    emp = await make_employee()
    cr = (await _create(client, emp["headers"], action="add", entry_time=ist(DAY, "09:00"), exit_time=ist(DAY, "10:00"), reason="Forgot")).json()
    r = await client.post(f"{API}/change-requests/{cr['id']}/cancel", headers=emp["headers"])
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert (await client.post(f"{API}/change-requests/{cr['id']}/cancel", headers=emp["headers"])).json()["error"]["code"] == "REQUEST_NOT_PENDING"
    assert (await client.post(f"{API}/change-requests/{cr['id']}/approve", headers=admin_headers)).status_code == 409


async def test_request_permissions(client, admin_headers, make_employee):
    a, b = await make_employee(), await make_employee()
    cr = (await _create(client, a["headers"], action="add", entry_time=ist(DAY, "09:00"), exit_time=ist(DAY, "10:00"), reason="Forgot")).json()
    url = f"{API}/change-requests/{cr['id']}"
    assert (await client.post(f"{url}/approve", headers=a["headers"])).status_code == 403
    assert (await client.post(f"{url}/reject", headers=a["headers"], json={"note": "x"})).status_code == 403
    assert (await client.get(url, headers=b["headers"])).status_code == 404
    assert (await client.post(f"{url}/cancel", headers=b["headers"])).status_code == 404
    assert (await client.post(f"{url}/cancel", headers=admin_headers)).status_code == 404  # only the requester may cancel
    assert (await client.get(url, headers=a["headers"])).status_code == 200
    got = (await client.get(url, headers=admin_headers)).json()
    assert got["requester"]["employee_id"] == a["user"]["employee_id"]
    assert (await client.get(f"{API}/change-requests", headers=a["headers"])).status_code == 403
    assert (await client.get(f"{API}/change-requests/not-an-id", headers=admin_headers)).status_code == 404


# ---------------- listing ----------------
async def test_listing_scopes_and_filters(client, admin_headers, make_employee):
    a, b = await make_employee(), await make_employee()
    for emp in (a, a, b):
        await _create(client, emp["headers"], action="add", entry_time=ist(DAY, "09:00") if emp is a else ist(DAY, "11:00"),
                      exit_time=ist(DAY, "10:00") if emp is a else ist(DAY, "12:00"), reason="Forgot")
    mine = (await client.get(f"{API}/change-requests/me", headers=a["headers"])).json()
    assert mine["meta"]["total"] == 2 and all(i["requester"]["employee_id"] == a["user"]["employee_id"] for i in mine["items"])
    allr = (await client.get(f"{API}/change-requests", headers=admin_headers)).json()
    assert allr["meta"]["total"] == 3
    by_emp = (await client.get(f"{API}/change-requests", headers=admin_headers, params={"employee": b["user"]["employee_id"]})).json()
    assert by_emp["meta"]["total"] == 1
    first = allr["items"][0]["id"]
    await client.post(f"{API}/change-requests/{first}/approve", headers=admin_headers)
    assert (await client.get(f"{API}/change-requests", headers=admin_headers, params={"status": "pending"})).json()["meta"]["total"] == 2
    assert (await client.get(f"{API}/change-requests", headers=admin_headers, params={"status": "approved"})).json()["meta"]["total"] == 1
    assert (await client.get(f"{API}/change-requests", headers=admin_headers, params={"page_size": 1})).json()["items"].__len__() == 1


async def test_status_filter_rejects_unknown_values(client, admin_headers):
    # NOTE: the frontend filter offers "withdrawn", but the backend status is "cancelled"
    for bad in ("withdrawn", "stale", "foo"):
        r = await client.get(f"{API}/change-requests", headers=admin_headers, params={"status": bad})
        assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_STATUS"
