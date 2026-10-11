import datetime as dt

import pytest
from bson import ObjectId

from tests.helpers import API, ist

DAY = "2025-01-06"  # Monday
UTC = dt.UTC


# ---------------- check-in / check-out ----------------
async def test_check_in_out_cycle(client, make_employee):
    h = make_employee and (await make_employee())["headers"]
    st = (await client.get(f"{API}/attendance/status", headers=h)).json()
    assert st == {"checked_in": False, "session": None}

    r = await client.post(f"{API}/attendance/check-in", headers=h)
    assert r.status_code == 201
    s = r.json()
    assert s["is_open"] is True and s["source"] == "live" and s["exit_time"] == "" and s["exit_time_iso"] == ""
    assert s["duration_minutes"] is None

    st = (await client.get(f"{API}/attendance/status", headers=h)).json()
    assert st["checked_in"] is True and st["session"]["id"] == s["id"]

    dup = await client.post(f"{API}/attendance/check-in", headers=h)
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "ALREADY_CHECKED_IN"

    out = await client.post(f"{API}/attendance/check-out", headers=h)
    assert out.status_code == 200
    o = out.json()
    assert o["id"] == s["id"] and o["is_open"] is False and o["exit_time_iso"] != "" and o["duration_minutes"] >= 0

    again = await client.post(f"{API}/attendance/check-out", headers=h)
    assert again.status_code == 409 and again.json()["error"]["code"] == "NOT_CHECKED_IN"
    assert (await client.get(f"{API}/attendance/status", headers=h)).json()["checked_in"] is False


async def test_can_check_in_again_after_check_out(client, make_employee, monkeypatch):
    import datetime as dt

    from app.utils.timefmt import utcnow

    h = (await make_employee())["headers"]
    await client.post(f"{API}/attendance/check-in", headers=h)
    
    # We must mock time for the check-out and second check-in to avoid overlap,
    # because check-out guarantees a minimum 1 second duration.
    base = utcnow()
    
    def _mock_now_checkout():
        return base + dt.timedelta(seconds=2)
        
    monkeypatch.setattr("app.services.attendance.utcnow", _mock_now_checkout)
    await client.post(f"{API}/attendance/check-out", headers=h)
    
    def _mock_now_checkin2():
        return base + dt.timedelta(seconds=4)
        
    monkeypatch.setattr("app.services.attendance.utcnow", _mock_now_checkin2)
    r = await client.post(f"{API}/attendance/check-in", headers=h)
    assert r.status_code == 201, r.text

async def test_check_in_requires_auth(client):
    assert (await client.post(f"{API}/attendance/check-in")).status_code == 401
    assert (await client.post(f"{API}/attendance/check-out")).status_code == 401
    assert (await client.get(f"{API}/attendance/status")).status_code == 401


async def test_open_sessions_are_per_employee(client, make_employee):
    a, b = await make_employee(), await make_employee()
    await client.post(f"{API}/attendance/check-in", headers=a["headers"])
    assert (await client.get(f"{API}/attendance/status", headers=b["headers"])).json()["checked_in"] is False
    assert (await client.post(f"{API}/attendance/check-in", headers=b["headers"])).status_code == 201


async def test_stale_open_session_is_auto_closed_on_check_in(client, db, make_employee):
    h = (await make_employee())["headers"]
    first = (await client.post(f"{API}/attendance/check-in", headers=h)).json()
    await db.attendance.update_one(
        {"_id": ObjectId(first["id"])},
        {"$set": {"entry_time": dt.datetime.now(UTC) - dt.timedelta(hours=20)}},
    )
    assert (await client.post(f"{API}/attendance/check-in", headers=h)).status_code == 201
    old = await db.attendance.find_one({"_id": ObjectId(first["id"])})
    assert old["auto_closed"] is True and old["is_open"] is False and old["duration_minutes"] == 16 * 60


async def test_check_out_after_cap_is_flagged_and_capped(client, db, make_employee):
    h = (await make_employee())["headers"]
    first = (await client.post(f"{API}/attendance/check-in", headers=h)).json()
    await db.attendance.update_one(
        {"_id": ObjectId(first["id"])},
        {"$set": {"entry_time": dt.datetime.now(UTC) - dt.timedelta(hours=20)}},
    )
    out = (await client.post(f"{API}/attendance/check-out", headers=h)).json()
    assert out["duration_minutes"] == 16 * 60
    assert (await db.attendance.find_one({"_id": ObjectId(first["id"])}))["auto_closed"] is True


async def test_deleting_open_session_releases_check_in(client, make_employee, admin_headers):
    h = (await make_employee())["headers"]
    s = (await client.post(f"{API}/attendance/check-in", headers=h)).json()
    assert (await client.delete(f"{API}/attendance/{s['id']}", headers=admin_headers)).status_code == 200
    assert (await client.get(f"{API}/attendance/status", headers=h)).json()["checked_in"] is False
    assert (await client.post(f"{API}/attendance/check-in", headers=h)).status_code == 201


# ---------------- manual sessions ----------------
async def test_manual_session_derives_fields(client, admin_headers, make_employee):
    emp = await make_employee()
    r = await client.post(f"{API}/attendance/manual", headers=admin_headers, json={
        "employee": emp["user"]["employee_id"], "entry_time": ist(DAY, "09:00"), "exit_time": ist(DAY, "14:00"), "note": "backfill"})
    assert r.status_code == 201, r.text
    s = r.json()
    assert s["source"] == "manual" and s["note"] == "backfill" and s["is_open"] is False
    assert s["duration_minutes"] == 300 and s["date"] == DAY and s["week_start"] == DAY
    assert s["entry_time"] == "January 6, 2025 9:00:00 AM"
    assert s["entry_time_iso"] == "2025-01-06T03:30:00Z" and s["exit_time_iso"] == "2025-01-06T08:30:00Z"


@pytest.mark.parametrize("day,entry,exit_,entry_iso", [
    ("2025-01-07", "January 7, 2025 9:00:00 AM", "January 7, 2025 2:00:00 PM", "2025-01-07T03:30:00Z"),
    ("2025-01-08", "01-08-2025 09:00:00", "01-08-2025 14:00:00", "2025-01-08T03:30:00Z"),
    ("2025-01-09", "2025-01-09T03:30:00Z", "2025-01-09T08:30:00Z", "2025-01-09T03:30:00Z"),
    ("2025-01-10", "2025-01-10T09:00:00", "2025-01-10T14:00:00", "2025-01-10T03:30:00Z"),  # naive = IST
])
async def test_manual_accepts_documented_formats(add_session, make_employee, day, entry, exit_, entry_iso):
    emp = await make_employee()
    s = await add_session(emp["user"]["id"], entry, exit_)
    assert s["entry_time_iso"] == entry_iso and s["date"] == day and s["duration_minutes"] == 300


async def test_manual_validation_errors(client, admin_headers, make_employee):
    emp = await make_employee()
    eid = emp["user"]["employee_id"]

    def body(**o):
        return {"employee": eid, "entry_time": ist(DAY, "09:00"), "exit_time": ist(DAY, "14:00"), **o}

    async def post(**o):
        return await client.post(f"{API}/attendance/manual", headers=admin_headers, json=body(**o))

    r = await post(exit_time=ist(DAY, "09:00"))
    assert r.status_code == 422 and r.json()["error"]["code"] == "EXIT_BEFORE_ENTRY"
    assert (await post(exit_time=ist(DAY, "08:00"))).json()["error"]["code"] == "EXIT_BEFORE_ENTRY"
    assert (await post(entry_time=ist(DAY, "01:00"), exit_time=ist(DAY, "18:00"))).json()["error"]["code"] == "SESSION_TOO_LONG"
    future = (dt.datetime.now(UTC) + dt.timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert (await post(entry_time=future, exit_time=future)).json()["error"]["code"] == "FUTURE_TIME"
    assert (await post(entry_time="garbage")).json()["error"]["code"] == "VALIDATION_ERROR"
    assert (await post(employee="EMP-999999")).json()["error"]["code"] == "USER_NOT_FOUND"
    assert (await post(note="x" * 501)).status_code == 422
    assert (await post(extra="x")).status_code == 422


async def test_manual_requires_admin(client, make_employee):
    emp = await make_employee()
    r = await client.post(f"{API}/attendance/manual", headers=emp["headers"], json={
        "employee": emp["user"]["id"], "entry_time": ist(DAY, "09:00"), "exit_time": ist(DAY, "14:00")})
    assert r.status_code == 403


async def test_overlap_rules(client, admin_headers, add_session, make_employee):
    emp = await make_employee()
    eid = emp["user"]["id"]
    await add_session(eid, ist(DAY, "09:00"), ist(DAY, "14:00"))
    for e, x in [("10:00", "11:00"), ("08:00", "10:00"), ("13:00", "15:00"), ("08:00", "15:00")]:
        r = await add_session(eid, ist(DAY, e), ist(DAY, x), expect=409)
        assert r["error"]["code"] == "OVERLAPPING_SESSION" and r["error"]["details"]["session_id"]
    await add_session(eid, ist(DAY, "14:00"), ist(DAY, "15:00"))  # back-to-back is allowed
    await add_session(eid, ist(DAY, "07:00"), ist(DAY, "09:00"))
    other = await make_employee()
    await add_session(other["user"]["id"], ist(DAY, "09:00"), ist(DAY, "14:00"))  # other employees unaffected


async def test_session_crossing_midnight_is_rejected(add_session, make_employee):
    emp = await make_employee()
    await add_session(emp["user"]["id"], ist(DAY, "22:00"), ist("2025-01-07", "02:00"), expect=422)


# ---------------- admin edit / delete ----------------
async def test_update_session(client, admin_headers, add_session, make_employee):
    emp = await make_employee()
    s = await add_session(emp["user"]["id"], ist(DAY, "09:00"), ist(DAY, "14:00"))
    url = f"{API}/attendance/{s['id']}"
    r = await client.patch(url, headers=admin_headers, json={"exit_time": ist(DAY, "15:30"), "note": "fixed"})
    assert r.status_code == 200
    u = r.json()
    assert u["duration_minutes"] == 390 and u["note"] == "fixed" and u["version"] == 2 and u["edited_by"]
    only_note = (await client.patch(url, headers=admin_headers, json={"note": "again"})).json()
    assert only_note["duration_minutes"] == 390
    moved = (await client.patch(url, headers=admin_headers, json={"entry_time": ist("2025-01-07", "09:00"), "exit_time": ist("2025-01-07", "10:00")})).json()
    assert moved["date"] == "2025-01-07" and moved["duration_minutes"] == 60


async def test_update_session_errors(client, admin_headers, add_session, make_employee):
    emp = await make_employee()
    a = await add_session(emp["user"]["id"], ist(DAY, "09:00"), ist(DAY, "12:00"))
    await add_session(emp["user"]["id"], ist(DAY, "13:00"), ist(DAY, "15:00"))
    url = f"{API}/attendance/{a['id']}"
    assert (await client.patch(url, headers=admin_headers, json={})).status_code == 422
    assert (await client.patch(url, headers=admin_headers, json={"exit_time": ist(DAY, "14:00")})).json()["error"]["code"] == "OVERLAPPING_SESSION"
    assert (await client.patch(url, headers=admin_headers, json={"exit_time": ist(DAY, "08:00")})).json()["error"]["code"] == "EXIT_BEFORE_ENTRY"
    for sid in ("bad", "64b7f0f0f0f0f0f0f0f0f0f0"):
        r = await client.patch(f"{API}/attendance/{sid}", headers=admin_headers, json={"note": "x"})
        assert r.status_code == 404 and r.json()["error"]["code"] == "SESSION_NOT_FOUND"
    assert (await client.patch(url, headers=admin_headers, json={"note": "x", "version": 1})).status_code == 422  # extra=forbid


async def test_employee_cannot_edit_or_delete(client, add_session, make_employee):
    emp = await make_employee()
    s = await add_session(emp["user"]["id"], ist(DAY, "09:00"), ist(DAY, "12:00"))
    assert (await client.patch(f"{API}/attendance/{s['id']}", headers=emp["headers"], json={"note": "x"})).status_code == 403
    assert (await client.delete(f"{API}/attendance/{s['id']}", headers=emp["headers"])).status_code == 403


async def test_delete_session_is_soft_and_slot_reusable(client, db, admin_headers, add_session, make_employee):
    emp = await make_employee()
    s = await add_session(emp["user"]["id"], ist(DAY, "09:00"), ist(DAY, "12:00"))
    assert (await client.delete(f"{API}/attendance/{s['id']}", headers=admin_headers)).status_code == 200
    doc = await db.attendance.find_one({"_id": ObjectId(s["id"])})
    assert doc["is_deleted"] is True and doc["deleted_by"]
    rows = (await client.get(f"{API}/attendance", headers=admin_headers, params={"employee": emp["user"]["id"], "from_date": DAY, "to_date": DAY})).json()
    assert rows["items"] == []
    assert (await client.delete(f"{API}/attendance/{s['id']}", headers=admin_headers)).status_code == 404
    await add_session(emp["user"]["id"], ist(DAY, "09:00"), ist(DAY, "12:00"))


# ---------------- listing ----------------
async def test_my_sessions_only_returns_own_and_respects_range(client, add_session, make_employee):
    a, b = await make_employee(), await make_employee()
    await add_session(a["user"]["id"], ist(DAY, "09:00"), ist(DAY, "10:00"))
    await add_session(a["user"]["id"], ist("2025-01-08", "09:00"), ist("2025-01-08", "10:00"))
    await add_session(b["user"]["id"], ist(DAY, "09:00"), ist(DAY, "10:00"))
    r = (await client.get(f"{API}/attendance/me", headers=a["headers"], params={"from_date": DAY, "to_date": "2025-01-07"})).json()
    assert len(r["items"]) == 1 and r["meta"]["total"] == 1 and r["items"][0]["employee_id"] == a["user"]["id"]
    both = (await client.get(f"{API}/attendance/me", headers=a["headers"], params={"from_date": DAY, "to_date": "2025-01-31"})).json()
    assert [i["date"] for i in both["items"]] == ["2025-01-08", DAY]  # newest first


async def test_admin_listing_with_and_without_employee_filter(client, admin_headers, add_session, make_employee):
    a, b = await make_employee(), await make_employee()
    await add_session(a["user"]["id"], ist(DAY, "09:00"), ist(DAY, "10:00"))
    await add_session(b["user"]["id"], ist(DAY, "09:00"), ist(DAY, "10:00"))
    params = {"from_date": DAY, "to_date": DAY}
    only_a = (await client.get(f"{API}/attendance", headers=admin_headers, params={**params, "employee": a["user"]["employee_id"]})).json()
    assert len(only_a["items"]) == 1
    everyone = (await client.get(f"{API}/attendance", headers=admin_headers, params=params)).json()
    assert len(everyone["items"]) == 2
    names = {i["employee"]["employee_id"] for i in everyone["items"]}
    assert names == {a["user"]["employee_id"], b["user"]["employee_id"]}
    assert all(i["employee"]["full_name"] for i in everyone["items"])
    paged = (await client.get(f"{API}/attendance", headers=admin_headers, params={**params, "page_size": 1, "page": 2})).json()
    assert len(paged["items"]) == 1 and paged["meta"]["total"] == 2
    assert (await client.get(f"{API}/attendance", headers=admin_headers, params={**params, "employee": "EMP-999999"})).status_code == 404


async def test_listing_range_validation(client, admin_headers, make_employee):
    emp = await make_employee()
    r = await client.get(f"{API}/attendance/me", headers=emp["headers"], params={"from_date": "2025-02-01", "to_date": "2025-01-01"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_RANGE"
    r = await client.get(f"{API}/attendance/me", headers=emp["headers"], params={"from_date": "2025-01-01", "to_date": "2025-06-01"})
    assert r.json()["error"]["code"] == "RANGE_TOO_LARGE"
    assert (await client.get(f"{API}/attendance/me", headers=emp["headers"])).status_code == 200  # default 30 days
    assert (await client.get(f"{API}/attendance", headers=emp["headers"])).status_code == 403
