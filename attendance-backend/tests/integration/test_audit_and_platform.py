
from app.config import settings
from tests.conftest import EMPLOYEE_PASSWORD
from tests.helpers import API


# ---------------- audit log ----------------
async def test_audit_log_records_admin_actions(client, admin_headers):
    await client.post(f"{API}/users", headers=admin_headers, json={"work_email": "a@kxn.com", "full_name": "A", "password": EMPLOYEE_PASSWORD})
    await client.post(f"{API}/holidays", headers=admin_headers, json={"date": "2026-10-02", "name": "H"})
    body = (await client.get(f"{API}/audit-logs", headers=admin_headers)).json()
    actions = [i["action"] for i in body["items"]]
    assert "user.created" in actions and "holiday.created" in actions
    first = body["items"][0]
    assert first["actor_name"] == "Administrator" and first["entity"]["type"] and first["ts"].endswith("Z")
    assert body["items"] == sorted(body["items"], key=lambda i: i["ts"], reverse=True)


async def test_audit_log_never_contains_secrets(client, admin_headers):
    await client.post(f"{API}/users", headers=admin_headers, json={"work_email": "s@kxn.com", "full_name": "S", "password": EMPLOYEE_PASSWORD})
    raw = (await client.get(f"{API}/audit-logs", headers=admin_headers)).text
    assert "password_hash" not in raw and EMPLOYEE_PASSWORD not in raw and "$argon2" not in raw


async def test_audit_search_pagination_and_access(client, admin_headers, make_employee):
    emp = await make_employee()
    r = (await client.get(f"{API}/audit-logs", headers=admin_headers, params={"q": "USER.CREATED"})).json()
    assert r["items"] and all("user.created" in i["action"] for i in r["items"])
    p = (await client.get(f"{API}/audit-logs", headers=admin_headers, params={"page_size": 1})).json()
    assert len(p["items"]) == 1 and p["meta"]["total"] >= 1
    assert (await client.get(f"{API}/audit-logs", headers=emp["headers"])).status_code == 403
    assert (await client.get(f"{API}/audit-logs")).status_code == 401


async def test_audit_search_with_invalid_regex_does_not_500(client, admin_headers):
    r = await client.get(f"{API}/audit-logs", headers=admin_headers, params={"q": "("})
    assert r.status_code < 500


async def test_no_write_routes_for_audit_logs(client, admin_headers):
    for method in ("post", "put", "patch", "delete"):
        r = await getattr(client, method)(f"{API}/audit-logs", headers=admin_headers)
        assert r.status_code == 405


# ---------------- middleware / errors ----------------
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


async def test_request_id_echo_and_generation(client):
    r = await client.get("/health", headers={"X-Request-ID": "abcdefgh12345"})
    assert r.headers["x-request-id"] == "abcdefgh12345"
    r = await client.get("/health", headers={"X-Request-ID": "bad id!"})
    assert len(r.headers["x-request-id"]) == 32 and r.headers["x-request-id"] != "bad id!"


async def test_security_headers(client):
    h = (await client.get("/health")).headers
    assert h["x-content-type-options"] == "nosniff" and h["x-frame-options"] == "DENY"
    assert h["referrer-policy"] == "no-referrer" and h["cache-control"] == "no-store"


async def test_oversized_body_rejected(client):
    big = b'{"identifier":"' + b"x" * (settings.MAX_REQUEST_BYTES + 10) + b'","password":"x"}'
    r = await client.post(f"{API}/auth/login", content=big, headers={"Content-Type": "application/json"})
    assert r.status_code == 413 and r.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


async def test_uniform_error_shapes(client):
    r = await client.get(f"{API}/does-not-exist")
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"
    r = await client.delete("/health")
    assert r.status_code == 405 and r.json()["error"]["code"] == "METHOD_NOT_ALLOWED"
    r = await client.post(f"{API}/auth/login", json={"identifier": "a"})
    err = r.json()["error"]
    assert r.status_code == 422 and err["code"] == "VALIDATION_ERROR" and err["details"][0]["loc"] == ["body", "password"]


async def test_validation_errors_never_echo_input(client):
    secret = "S3cret-" + "x" * 300
    r = await client.post(f"{API}/auth/login", json={"identifier": "a", "password": secret})
    assert r.status_code == 422 and secret not in r.text and "input" not in r.text


async def test_forbidden_error_shape(client, make_employee):
    emp = await make_employee()
    r = await client.get(f"{API}/users", headers=emp["headers"])
    assert r.status_code == 403 and r.json()["error"]["code"] == "FORBIDDEN"


async def test_docs_disabled_outside_local(monkeypatch):
    from httpx import ASGITransport, AsyncClient

    from app.main import create_app

    monkeypatch.setattr(settings, "APP_ENV", "production")
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        assert (await c.get("/docs")).status_code == 404
        assert (await c.get("/openapi.json")).status_code == 404


async def test_cors_allowlist(monkeypatch):
    from httpx import ASGITransport, AsyncClient

    from app.main import create_app

    monkeypatch.setattr(settings, "CORS_ORIGINS", "http://localhost:5173")
    app = create_app()
    hdr = {"Access-Control-Request-Method": "POST"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        ok = await c.options("/health", headers={"Origin": "http://localhost:5173", **hdr})
        bad = await c.options("/health", headers={"Origin": "http://evil.com", **hdr})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-origin" not in bad.headers
