import pytest

from tests.helpers import API


async def _hol(client, h, date="2026-10-02", name="Gandhi Jayanti"):
    r = await client.post(f"{API}/holidays", headers=h, json={"date": date, "name": name})
    assert r.status_code == 201, r.text
    return r.json()


async def test_create_and_list(client, admin_headers):
    h = await _hol(client, admin_headers, name="  Gandhi   Jayanti ")
    assert h["date"] == "2026-10-02" and h["name"] == "Gandhi Jayanti"
    await _hol(client, admin_headers, "2026-01-26", "Republic Day")
    await _hol(client, admin_headers, "2027-01-26", "Republic Day 27")
    items = (await client.get(f"{API}/holidays", headers=admin_headers, params={"year": 2026})).json()["items"]
    assert [i["date"] for i in items] == ["2026-01-26", "2026-10-02"]  # sorted, year-filtered
    rng = (await client.get(f"{API}/holidays", headers=admin_headers,
                            params={"from_date": "2026-10-01", "to_date": "2027-02-01"})).json()["items"]
    assert [i["date"] for i in rng] == ["2026-10-02", "2027-01-26"]


async def test_duplicate_date(client, admin_headers):
    await _hol(client, admin_headers)
    r = await client.post(f"{API}/holidays", headers=admin_headers, json={"date": "2026-10-02", "name": "Other"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "HOLIDAY_DATE_TAKEN"


@pytest.mark.parametrize("body", [
    {"date": "1999-12-31", "name": "x"}, {"date": "2101-01-01", "name": "x"},
    {"date": "2026-10-02", "name": ""}, {"date": "2026-10-02", "name": "x" * 121},
    {"date": "not-a-date", "name": "x"}, {"name": "x"}, {"date": "2026-10-02", "name": "x", "extra": 1},
])
async def test_create_validation(client, admin_headers, body):
    assert (await client.post(f"{API}/holidays", headers=admin_headers, json=body)).status_code == 422


async def test_list_range_rules(client, admin_headers):
    r = await client.get(f"{API}/holidays", headers=admin_headers, params={"from_date": "2026-01-01"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_RANGE"
    r = await client.get(f"{API}/holidays", headers=admin_headers, params={"from_date": "2026-02-01", "to_date": "2026-01-01"})
    assert r.json()["error"]["code"] == "INVALID_RANGE"
    r = await client.get(f"{API}/holidays", headers=admin_headers, params={"from_date": "2020-01-01", "to_date": "2022-01-01"})
    assert r.json()["error"]["code"] == "RANGE_TOO_LARGE"
    assert (await client.get(f"{API}/holidays", headers=admin_headers, params={"year": 1999})).status_code == 422


async def test_employee_read_only(client, admin_headers, make_employee):
    emp = await make_employee()
    h = await _hol(client, admin_headers)
    assert (await client.get(f"{API}/holidays", headers=emp["headers"], params={"year": 2026})).status_code == 200
    assert (await client.get(f"{API}/holidays/{h['id']}", headers=emp["headers"])).status_code == 200
    assert (await client.post(f"{API}/holidays", headers=emp["headers"], json={"date": "2026-11-01", "name": "x"})).status_code == 403
    assert (await client.patch(f"{API}/holidays/{h['id']}", headers=emp["headers"], json={"name": "x"})).status_code == 403
    assert (await client.delete(f"{API}/holidays/{h['id']}", headers=emp["headers"])).status_code == 403


async def test_update_holiday(client, admin_headers):
    a = await _hol(client, admin_headers, "2026-10-02", "A")
    b = await _hol(client, admin_headers, "2026-10-20", "B")
    ok = await client.patch(f"{API}/holidays/{a['id']}", headers=admin_headers, json={"name": "  A  renamed "})
    assert ok.json()["name"] == "A renamed"
    r = await client.patch(f"{API}/holidays/{a['id']}", headers=admin_headers, json={"date": "2026-10-20"})
    assert r.status_code == 409
    assert (await client.patch(f"{API}/holidays/{b['id']}", headers=admin_headers, json={"date": "2026-10-21"})).json()["date"] == "2026-10-21"
    assert (await client.patch(f"{API}/holidays/{a['id']}", headers=admin_headers, json={"date": "2026-10-02"})).status_code == 200  # same date ok
    assert (await client.patch(f"{API}/holidays/{a['id']}", headers=admin_headers, json={})).json()["error"]["code"] == "NO_CHANGES"
    assert (await client.patch(f"{API}/holidays/{a['id']}", headers=admin_headers, json={"name": None})).json()["error"]["code"] == "INVALID_FIELD"
    assert (await client.patch(f"{API}/holidays/{a['id']}", headers=admin_headers, json={"date": None})).json()["error"]["code"] == "INVALID_FIELD"


async def test_delete_is_hard_and_frees_date(client, admin_headers):
    h = await _hol(client, admin_headers)
    assert (await client.delete(f"{API}/holidays/{h['id']}", headers=admin_headers)).status_code == 200
    assert (await client.get(f"{API}/holidays/{h['id']}", headers=admin_headers)).status_code == 404
    assert (await client.delete(f"{API}/holidays/{h['id']}", headers=admin_headers)).status_code == 404
    await _hol(client, admin_headers)


async def test_unknown_holiday_id(client, admin_headers):
    for hid in ("bad", "64b7f0f0f0f0f0f0f0f0f0f0"):
        r = await client.get(f"{API}/holidays/{hid}", headers=admin_headers)
        assert r.status_code == 404 and r.json()["error"]["code"] == "HOLIDAY_NOT_FOUND"
