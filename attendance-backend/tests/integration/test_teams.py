from tests.helpers import API


async def _team(client, h, name="Backend", **kw):
    r = await client.post(f"{API}/teams", headers=h, json={"name": name, **kw})
    assert r.status_code == 201, r.text
    return r.json()


async def test_create_team_normalises_name(client, admin_headers):
    t = await _team(client, admin_headers, "  Core   Platform ", description="d")
    assert t["name"] == "Core Platform" and t["name_lower"] == "core platform"
    assert t["member_count"] == 0 and t["description"] == "d"


async def test_duplicate_team_name_case_insensitive(client, admin_headers):
    await _team(client, admin_headers, "Design")
    r = await client.post(f"{API}/teams", headers=admin_headers, json={"name": "DESIGN"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "TEAM_NAME_TAKEN"


async def test_team_validation(client, admin_headers):
    assert (await client.post(f"{API}/teams", headers=admin_headers, json={"name": ""})).status_code == 422
    assert (await client.post(f"{API}/teams", headers=admin_headers, json={"name": "x" * 81})).status_code == 422
    assert (await client.post(f"{API}/teams", headers=admin_headers, json={"name": "ok", "foo": 1})).status_code == 422


async def test_employee_can_read_but_not_write(client, admin_headers, make_employee):
    emp = await make_employee()
    t = await _team(client, admin_headers)
    assert (await client.get(f"{API}/teams", headers=emp["headers"])).status_code == 200
    assert (await client.get(f"{API}/teams/{t['id']}", headers=emp["headers"])).status_code == 200
    assert (await client.post(f"{API}/teams", headers=emp["headers"], json={"name": "X"})).status_code == 403
    assert (await client.patch(f"{API}/teams/{t['id']}", headers=emp["headers"], json={"name": "X"})).status_code == 403
    assert (await client.delete(f"{API}/teams/{t['id']}", headers=emp["headers"])).status_code == 403
    assert (await client.get(f"{API}/teams/{t['id']}/members", headers=emp["headers"])).status_code == 403
    assert (await client.put(f"{API}/teams/{t['id']}/members", headers=emp["headers"], json={"member_ids": []})).status_code == 403


async def test_list_search_and_counts(client, admin_headers, make_employee):
    a, _b = await _team(client, admin_headers, "Alpha"), await _team(client, admin_headers, "Beta")
    emp = await make_employee()
    await client.put(f"{API}/teams/{a['id']}/members", headers=admin_headers, json={"member_ids": [emp["user"]["id"]]})
    items = (await client.get(f"{API}/teams", headers=admin_headers)).json()["items"]
    assert [i["name"] for i in items] == ["Alpha", "Beta"]
    assert {i["name"]: i["member_count"] for i in items} == {"Alpha": 1, "Beta": 0}
    found = (await client.get(f"{API}/teams", headers=admin_headers, params={"q": "BET"})).json()
    assert [i["name"] for i in found["items"]] == ["Beta"] and found["meta"]["total"] == 1


async def test_get_update_team(client, admin_headers):
    t = await _team(client, admin_headers, "Ops")
    u = await client.patch(f"{API}/teams/{t['id']}", headers=admin_headers, json={"name": "Ops2", "description": "x"})
    assert u.status_code == 200 and u.json()["name"] == "Ops2"
    cleared = await client.patch(f"{API}/teams/{t['id']}", headers=admin_headers, json={"description": None})
    assert cleared.json()["description"] is None
    assert (await client.patch(f"{API}/teams/{t['id']}", headers=admin_headers, json={})).json()["error"]["code"] == "NO_CHANGES"
    assert (await client.patch(f"{API}/teams/{t['id']}", headers=admin_headers, json={"name": None})).json()["error"]["code"] == "INVALID_FIELD"
    other = await _team(client, admin_headers, "Other")
    r = await client.patch(f"{API}/teams/{other['id']}", headers=admin_headers, json={"name": "ops2"})
    assert r.status_code == 409
    # renaming to its own name is fine
    assert (await client.patch(f"{API}/teams/{t['id']}", headers=admin_headers, json={"name": "OPS2"})).status_code == 200


async def test_not_found_variants(client, admin_headers):
    for tid in ("not-an-id", "64b7f0f0f0f0f0f0f0f0f0f0"):
        r = await client.get(f"{API}/teams/{tid}", headers=admin_headers)
        assert r.status_code == 404 and r.json()["error"]["code"] == "TEAM_NOT_FOUND"


async def test_set_members_replaces_list(client, admin_headers, make_employee):
    t = await _team(client, admin_headers)
    a, b, c = await make_employee(), await make_employee(), await make_employee()
    url = f"{API}/teams/{t['id']}/members"
    r = await client.put(url, headers=admin_headers, json={"member_ids": [a["user"]["id"], b["user"]["id"]]})
    assert r.status_code == 200 and r.json()["member_count"] == 2
    r = await client.put(url, headers=admin_headers, json={"member_ids": [b["user"]["id"], c["user"]["id"]]})
    assert r.json()["member_count"] == 2
    ids = {m["id"] for m in (await client.get(url, headers=admin_headers)).json()["items"]}
    assert ids == {b["user"]["id"], c["user"]["id"]}
    prof = (await client.get(f"{API}/users/{a['user']['id']}", headers=admin_headers)).json()
    assert t["id"] not in prof["professional"]["team_ids"]
    prof = (await client.get(f"{API}/users/{c['user']['id']}", headers=admin_headers)).json()
    assert t["id"] in prof["professional"]["team_ids"]
    assert (await client.put(url, headers=admin_headers, json={"member_ids": []})).json()["member_count"] == 0


async def test_member_may_belong_to_many_teams(client, admin_headers, make_employee):
    t1, t2 = await _team(client, admin_headers, "T1"), await _team(client, admin_headers, "T2")
    emp = await make_employee()
    for t in (t1, t2):
        await client.put(f"{API}/teams/{t['id']}/members", headers=admin_headers, json={"member_ids": [emp["user"]["id"]]})
    prof = (await client.get(f"{API}/users/{emp['user']['id']}", headers=admin_headers)).json()
    assert set(prof["professional"]["team_ids"]) == {t1["id"], t2["id"]}


async def test_members_payload_ignores_invalid_ids(client, admin_headers):
    t = await _team(client, admin_headers)
    r = await client.put(f"{API}/teams/{t['id']}/members", headers=admin_headers, json={"member_ids": ["nope"]})
    assert r.status_code == 200 and r.json()["member_count"] == 0


async def test_delete_team_unlinks_members_and_frees_name(client, admin_headers, make_employee):
    t = await _team(client, admin_headers, "Temp")
    emp = await make_employee()
    await client.put(f"{API}/teams/{t['id']}/members", headers=admin_headers, json={"member_ids": [emp["user"]["id"]]})
    assert (await client.delete(f"{API}/teams/{t['id']}", headers=admin_headers)).status_code == 200
    assert (await client.get(f"{API}/teams/{t['id']}", headers=admin_headers)).status_code == 404
    prof = (await client.get(f"{API}/users/{emp['user']['id']}", headers=admin_headers)).json()
    assert t["id"] not in prof["professional"]["team_ids"]
    assert (await client.delete(f"{API}/teams/{t['id']}", headers=admin_headers)).status_code == 404
    await _team(client, admin_headers, "Temp")  # name reusable
