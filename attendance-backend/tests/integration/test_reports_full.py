import datetime as dt

import pytest
from bson import ObjectId

from tests.helpers import API, ist

MON, TUE, WED, THU, FRI, SAT = "2025-01-06", "2025-01-07", "2025-01-08", "2025-01-09", "2025-01-10", "2025-01-11"
WEEK = {"from_date": MON, "to_date": "2025-01-12"}


async def _work(add_session, emp, day, start="09:00", end="14:00"):
    return await add_session(emp["user"]["id"], ist(day, start), ist(day, end))


# ---------------- daily ----------------
async def test_my_daily_report_totals(client, add_session, make_employee):
    emp = await make_employee()
    await _work(add_session, emp, MON, "09:00", "14:00")
    await _work(add_session, emp, MON, "15:00", "16:00")
    await _work(add_session, emp, SAT, "10:00", "12:00")
    r = await client.get(f"{API}/reports/me/daily", headers=emp["headers"], params=WEEK)
    assert r.status_code == 200
    rep = r.json()
    assert len(rep["days"]) == 7 and rep["employee"]["employee_id"] == emp["user"]["employee_id"]
    mon, sat = rep["days"][0], rep["days"][5]
    assert (mon["weekday"], mon["day_type"], mon["minutes"], mon["hours"], mon["sessions"], mon["attended"]) == ("Monday", "working", 360, 6.0, 2, True)
    assert sat["day_type"] == "weekly_off" and sat["minutes"] == 120
    t = rep["totals"]
    assert t["working_days"] == 5 and t["weekly_off_days"] == 2 and t["holidays"] == 0
    assert t["attended_working_days"] == 1 and t["working_minutes"] == 360 and t["extra_minutes"] == 120
    assert t["working_hours"] == 6.0 and t["extra_hours"] == 2.0


async def test_daily_report_marks_holidays_and_short_days(client, admin_headers, add_session, make_employee):
    emp = await make_employee()
    await client.post(f"{API}/holidays", headers=admin_headers, json={"date": WED, "name": "H"})
    await _work(add_session, emp, WED, "09:00", "12:00")          # worked on a holiday -> extra
    await _work(add_session, emp, TUE, "09:00", "09:30")           # 30 min: not attended
    rep = (await client.get(f"{API}/reports/me/daily", headers=emp["headers"], params=WEEK)).json()
    assert rep["days"][2]["day_type"] == "holiday"
    assert rep["days"][1]["attended"] is False and rep["days"][1]["minutes"] == 30
    assert rep["totals"]["holidays"] == 1 and rep["totals"]["working_days"] == 4 and rep["totals"]["extra_minutes"] == 180


async def test_daily_report_counts_open_session_live(client, make_employee):
    emp = await make_employee()
    await client.post(f"{API}/attendance/check-in", headers=emp["headers"])
    today = dt.datetime.now(dt.UTC).astimezone(__import__("zoneinfo").ZoneInfo("Asia/Kolkata")).date().isoformat()
    rep = (await client.get(f"{API}/reports/me/daily", headers=emp["headers"], params={"from_date": today, "to_date": today})).json()
    assert rep["days"][0]["has_open_session"] is True and rep["days"][0]["sessions"] == 1


async def test_daily_report_range_rules(client, make_employee):
    h = (await make_employee())["headers"]
    r = await client.get(f"{API}/reports/me/daily", headers=h, params={"from_date": "2025-02-01", "to_date": "2025-01-01"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_RANGE"
    r = await client.get(f"{API}/reports/me/daily", headers=h, params={"from_date": "2025-01-01", "to_date": "2025-06-01"})
    assert r.json()["error"]["code"] == "RANGE_TOO_LARGE"
    assert (await client.get(f"{API}/reports/me/daily", headers=h)).status_code == 200


# ---------------- weekly ----------------
async def test_weekly_compliant(client, add_session, make_employee):
    emp = await make_employee()
    for d in (MON, TUE, WED):
        await _work(add_session, emp, d)
    rep = (await client.get(f"{API}/reports/me/weekly", headers=emp["headers"], params=WEEK)).json()
    w = rep["weeks"][0]
    assert w["week_start"] == MON and w["compliant"] is True and w["applicable"] and w["complete"]
    assert (w["attended_days"], w["counted_minutes"], w["required_days"], w["required_minutes"]) == (3, 900, 3, 900)
    assert rep["summary"] == {"completed_weeks": 1, "compliant_weeks": 1, "non_compliant_weeks": 0}


async def test_weekly_hours_shortfall(client, add_session, make_employee):
    emp = await make_employee()
    for d in (MON, TUE, WED):
        await _work(add_session, emp, d, "09:00", "12:20")  # 200 min each
    w = (await client.get(f"{API}/reports/me/weekly", headers=emp["headers"], params=WEEK)).json()["weeks"][0]
    assert w["attended_days"] == 3 and w["shortfall_days"] == 0 and w["shortfall_minutes"] == 300 and w["compliant"] is False


async def test_weekly_days_shortfall(client, add_session, make_employee):
    emp = await make_employee()
    await _work(add_session, emp, MON, "08:00", "18:00")
    await _work(add_session, emp, TUE, "08:00", "18:00")
    w = (await client.get(f"{API}/reports/me/weekly", headers=emp["headers"], params=WEEK)).json()["weeks"][0]
    assert w["counted_minutes"] == 1200 and w["shortfall_days"] == 1 and w["compliant"] is False


async def test_weekly_holiday_lowers_requirement(client, admin_headers, add_session, make_employee):
    emp = await make_employee()
    await client.post(f"{API}/holidays", headers=admin_headers, json={"date": WED, "name": "H"})
    await _work(add_session, emp, MON)
    await _work(add_session, emp, TUE)
    w = (await client.get(f"{API}/reports/me/weekly", headers=emp["headers"], params=WEEK)).json()["weeks"][0]
    assert w["holidays_on_working_days"] == 1 and w["required_days"] == 2 and w["required_minutes"] == 600 and w["compliant"] is True


async def test_weekly_not_applicable_before_joining(client, make_employee):
    emp = await make_employee(joining_date="2030-01-01")
    rep = (await client.get(f"{API}/reports/me/weekly", headers=emp["headers"], params=WEEK)).json()
    assert rep["weeks"][0]["applicable"] is False and rep["weeks"][0]["compliant"] is None
    assert rep["summary"]["completed_weeks"] == 0


async def test_weekly_spans_multiple_weeks_and_range_rules(client, make_employee):
    h = (await make_employee())["headers"]
    rep = (await client.get(f"{API}/reports/me/weekly", headers=h, params={"from_date": "2025-01-08", "to_date": "2025-01-20"})).json()
    assert [w["week_start"] for w in rep["weeks"]] == ["2025-01-06", "2025-01-13", "2025-01-20"]
    r = await client.get(f"{API}/reports/me/weekly", headers=h, params={"from_date": "2020-01-01", "to_date": "2022-01-01"})
    assert r.json()["error"]["code"] == "RANGE_TOO_LARGE"
    assert (await client.get(f"{API}/reports/me/weekly", headers=h)).status_code == 200


# ---------------- admin views of one employee ----------------
async def test_admin_can_read_any_employee_and_employee_cannot(client, admin_headers, add_session, make_employee):
    a, b = await make_employee(), await make_employee()
    await _work(add_session, a, MON)
    for path in ("daily", "weekly"):
        r = await client.get(f"{API}/reports/{path}", headers=admin_headers, params={"employee": a["user"]["employee_id"], **WEEK})
        assert r.status_code == 200 and r.json()["employee"]["id"] == a["user"]["id"]
        assert (await client.get(f"{API}/reports/{path}", headers=b["headers"], params={"employee": a["user"]["id"], **WEEK})).status_code == 403
        assert (await client.get(f"{API}/reports/{path}", headers=admin_headers, params=WEEK)).status_code == 422  # employee required
        assert (await client.get(f"{API}/reports/{path}", headers=admin_headers, params={"employee": "EMP-999999"})).status_code == 404


# ---------------- weekly overview ----------------
async def test_weekly_overview(client, admin_headers, add_session, make_employee):
    good, bad = await make_employee(), await make_employee()
    for d in (MON, TUE, WED):
        await _work(add_session, good, d)
    r = await client.get(f"{API}/reports/weekly-overview", headers=admin_headers, params={"week_start": WED})
    assert r.status_code == 200
    body = r.json()
    assert body["week_start"] == MON and body["meta"]["total"] == 2  # admin is not an employee
    by = {i["employee"]["employee_id"]: i for i in body["items"]}
    assert by[good["user"]["employee_id"]]["compliant"] is True
    assert by[bad["user"]["employee_id"]]["compliant"] is False
    assert all(i["complete"] for i in body["items"])


async def test_weekly_overview_filters_pagination_and_access(client, admin_headers, make_employee):
    a, _b = await make_employee(), await make_employee()
    team = (await client.post(f"{API}/teams", headers=admin_headers, json={"name": "T"})).json()
    await client.put(f"{API}/teams/{team['id']}/members", headers=admin_headers, json={"member_ids": [a["user"]["id"]]})
    r = (await client.get(f"{API}/reports/weekly-overview", headers=admin_headers, params={"week_start": MON, "team_id": team["id"]})).json()
    assert [i["employee"]["employee_id"] for i in r["items"]] == [a["user"]["employee_id"]]
    p = (await client.get(f"{API}/reports/weekly-overview", headers=admin_headers, params={"week_start": MON, "page_size": 1})).json()
    assert len(p["items"]) == 1 and p["meta"]["total"] == 2
    assert (await client.get(f"{API}/reports/weekly-overview", headers=admin_headers, params={"team_id": "bad"})).json()["error"]["code"] == "INVALID_TEAM"
    assert (await client.get(f"{API}/reports/weekly-overview", headers=a["headers"])).status_code == 403


async def test_weekly_overview_skips_inactive_and_future_joiners(client, admin_headers, make_employee):
    inactive = await make_employee()
    await make_employee(joining_date="2999-01-01")
    await client.patch(f"{API}/users/{inactive['user']['id']}", headers=admin_headers, json={"status": "inactive"})
    r = (await client.get(f"{API}/reports/weekly-overview", headers=admin_headers, params={"week_start": MON})).json()
    assert r["items"] == []


# ---------------- BI ----------------
async def test_bi_summary_and_trends(client, admin_headers, add_session, make_employee):
    emp = await make_employee()
    for d in (MON, TUE, WED):
        await _work(add_session, emp, d)
    params = {"from_date": MON, "to_date": FRI}
    k = (await client.get(f"{API}/reports/bi/summary", headers=admin_headers, params=params)).json()["kpis"]
    assert k["active_employees"] == 1 and k["expected_days"] == 5 and k["present_days"] == 3 and k["absent_days"] == 2
    assert k["attendance_rate"] == 60.0 and k["total_worked_hours"] == 15.0 and k["average_worked_hours"] == 3.0 and k["open_sessions"] == 0
    trend = (await client.get(f"{API}/reports/bi/trends", headers=admin_headers, params=params)).json()
    assert [t["present"] for t in trend] == [1, 1, 1, 0, 0] and all(t["expected"] == 1 for t in trend)
    assert trend[0]["rate"] == 100.0 and trend[4]["rate"] == 0.0


async def test_bi_excludes_weekends_and_holidays_and_pre_joining(client, admin_headers, make_employee):
    await make_employee()
    await make_employee(joining_date=WED)
    await client.post(f"{API}/holidays", headers=admin_headers, json={"date": TUE, "name": "H"})
    k = (await client.get(f"{API}/reports/bi/summary", headers=admin_headers, params={"from_date": MON, "to_date": "2025-01-12"})).json()["kpis"]
    # working days: Mon, Wed, Thu, Fri (Tue holiday). emp1 -> 4 days, emp2 (joined Wed; active filter uses end date) -> 3 days
    assert k["expected_days"] == 7


async def test_bi_teams_ranking(client, admin_headers, add_session, make_employee):
    a, b = await make_employee(), await make_employee()
    t1 = (await client.post(f"{API}/teams", headers=admin_headers, json={"name": "Good"})).json()
    t2 = (await client.post(f"{API}/teams", headers=admin_headers, json={"name": "Bad"})).json()
    await client.put(f"{API}/teams/{t1['id']}/members", headers=admin_headers, json={"member_ids": [a["user"]["id"]]})
    await client.put(f"{API}/teams/{t2['id']}/members", headers=admin_headers, json={"member_ids": [b["user"]["id"]]})
    for d in (MON, TUE):
        await _work(add_session, a, d)
    rows = (await client.get(f"{API}/reports/bi/teams", headers=admin_headers, params={"from_date": MON, "to_date": FRI})).json()
    assert [r["team"]["name"] for r in rows] == ["Good", "Bad"]
    assert rows[0]["attendance_rate"] == 40.0 and rows[0]["size"] == 1 and rows[1]["attendance_rate"] == 0


async def test_bi_exceptions_lists_missing_checkouts(client, db, admin_headers, make_employee):
    emp = await make_employee()
    await db.attendance.insert_one({
        "employee_id": ObjectId(emp["user"]["id"]), "is_deleted": False, "is_open": True,
        "entry_time": dt.datetime(2025, 1, 7, 4, 0, tzinfo=dt.UTC), "exit_time": None,
        "date": TUE, "week_start": MON, "duration_minutes": None, "source": "live", "version": 1,
    })
    r = (await client.get(f"{API}/reports/bi/exceptions", headers=admin_headers, params={"from_date": MON, "to_date": FRI})).json()
    assert r["meta"]["total"] == 1
    item = r["items"][0]
    assert item["type"] == "Missing Check-out" and item["severity"] == "high" and item["exit_time"] is None
    assert item["employee"]["employee_id"] == emp["user"]["employee_id"] and item["date"] == TUE


async def test_bi_exceptions_timestamps_are_valid_iso(client, db, admin_headers, make_employee):
    emp = await make_employee()
    await db.attendance.insert_one({
        "employee_id": ObjectId(emp["user"]["id"]), "is_deleted": False, "is_open": True,
        "entry_time": dt.datetime(2025, 1, 7, 4, 0, tzinfo=dt.UTC), "exit_time": None,
        "date": TUE, "week_start": MON, "duration_minutes": None, "source": "live", "version": 1,
    })
    item = (await client.get(f"{API}/reports/bi/exceptions", headers=admin_headers, params={"from_date": MON, "to_date": FRI})).json()["items"][0]
    assert "+00:00" not in item["entry_time"]


@pytest.mark.parametrize("path", ["summary", "trends", "teams", "exceptions"])
async def test_bi_is_admin_only(client, make_employee, path):
    emp = await make_employee()
    assert (await client.get(f"{API}/reports/bi/{path}", headers=emp["headers"])).status_code == 403
    assert (await client.get(f"{API}/reports/bi/{path}")).status_code == 401
