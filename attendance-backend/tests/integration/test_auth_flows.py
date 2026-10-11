from datetime import timedelta

import pytest

from app.config import settings
from app.core.security import new_opaque_token
from app.utils.timefmt import utcnow
from tests.conftest import EMPLOYEE_PASSWORD, bearer, login
from tests.helpers import API

NEW_PASSWORD = "BrandNewPass9"


async def _bad_login(client, ident, pw="WrongPass123"):
    return await client.post(f"{API}/auth/login", json={"identifier": ident, "password": pw})


# ---------------- signup ----------------
async def test_signup_creates_employee_and_returns_tokens(client):
    r = await client.post(f"{API}/auth/signup", json={
        "work_email": "Sam@KXN.com", "full_name": "  Sam Lee ", "password": "StrongPass123", "phone": "+91 99999 99999",
    })
    assert r.status_code == 201, r.text
    body = (await client.get(f"{API}/auth/me", headers=bearer(r.json()))).json()
    assert body["role"] == "employee" and body["status"] == "active"
    assert body["work_email"] == "sam@kxn.com"
    assert body["personal"]["full_name"] == "Sam Lee"
    assert body["employee_id"].startswith("EMP-")
    assert "password_hash" not in body and "token_version" not in body


async def test_signup_duplicate_email_case_insensitive(client):
    payload = {"work_email": "dup@kxn.com", "full_name": "A", "password": "StrongPass123"}
    assert (await client.post(f"{API}/auth/signup", json=payload)).status_code == 201
    r = await client.post(f"{API}/auth/signup", json={**payload, "work_email": "DUP@kxn.com"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "EMAIL_TAKEN"


async def test_signup_assigns_sequential_employee_ids(client):
    ids = []
    for i in range(2):
        t = (await client.post(f"{API}/auth/signup", json={
            "work_email": f"seq{i}@kxn.com", "full_name": "S", "password": "StrongPass123"})).json()
        ids.append((await client.get(f"{API}/auth/me", headers=bearer(t))).json()["employee_id"])
    assert ids[0] != ids[1] and ids == sorted(ids)


@pytest.mark.parametrize("pw", ["short1A", "alllowercase123", "ALLUPPERCASE123", "NoDigitsHereAtAll"])
async def test_signup_weak_password(client, pw):
    r = await client.post(f"{API}/auth/signup", json={"work_email": "w@kxn.com", "full_name": "W", "password": pw})
    assert r.status_code == 422 and r.json()["error"]["code"] == "WEAK_PASSWORD"


async def test_signup_rejects_role_escalation_and_bad_email(client):
    base = {"work_email": "x@kxn.com", "full_name": "X", "password": "StrongPass123"}
    assert (await client.post(f"{API}/auth/signup", json={**base, "role": "admin"})).status_code == 422
    assert (await client.post(f"{API}/auth/signup", json={**base, "work_email": "nope"})).status_code == 422
    assert (await client.post(f"{API}/auth/signup", json={**base, "full_name": ""})).status_code == 422


async def test_signup_domain_allowlist(client, monkeypatch):
    monkeypatch.setattr(settings, "ALLOWED_SIGNUP_DOMAINS", "kxn.com")
    bad = await client.post(f"{API}/auth/signup", json={"work_email": "a@evil.com", "full_name": "A", "password": "StrongPass123"})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "EMAIL_DOMAIN_NOT_ALLOWED"
    ok = await client.post(f"{API}/auth/signup", json={"work_email": "a@kxn.com", "full_name": "A", "password": "StrongPass123"})
    assert ok.status_code == 201


# ---------------- login ----------------
async def test_login_by_email_any_case_and_by_employee_code(client, make_employee):
    emp = await make_employee()
    t1 = await login(client, emp["user"]["work_email"].upper(), emp["password"])
    t2 = await login(client, emp["user"]["employee_id"].lower(), emp["password"])
    assert t1["token_type"] == "bearer" and t1["expires_in"] == settings.ACCESS_TOKEN_MINUTES * 60
    assert t2["access_token"] and t2["refresh_token"]


async def test_wrong_password_and_unknown_user_are_indistinguishable(client, make_employee):
    emp = await make_employee()
    a = await _bad_login(client, emp["user"]["work_email"])
    b = await _bad_login(client, "ghost@kxn.com")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()
    assert a.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_lockout_after_repeated_failures(client, make_employee):
    emp = await make_employee()
    for _ in range(settings.LOGIN_MAX_FAILURES):
        assert (await _bad_login(client, emp["user"]["work_email"])).status_code == 401
    r = await _bad_login(client, emp["user"]["work_email"], emp["password"])  # correct password, still locked
    assert r.status_code == 401 and r.json()["error"]["code"] == "ACCOUNT_LOCKED"


async def test_lock_expires(client, db, make_employee):
    emp = await make_employee()
    for _ in range(settings.LOGIN_MAX_FAILURES):
        await _bad_login(client, emp["user"]["work_email"])
    await db.users.update_one({"work_email": emp["user"]["work_email"]}, {"$set": {"locked_until": utcnow() - timedelta(minutes=1)}})
    assert (await _bad_login(client, emp["user"]["work_email"], emp["password"])).status_code == 200


async def test_successful_login_resets_failure_counter(client, db, make_employee):
    emp = await make_employee()
    for _ in range(3):
        await _bad_login(client, emp["user"]["work_email"])
    await login(client, emp["user"]["work_email"], emp["password"])
    doc = await db.users.find_one({"work_email": emp["user"]["work_email"]})
    assert doc["failed_login_count"] == 0


async def test_inactive_account_cannot_login(client, make_employee, admin_headers):
    emp = await make_employee()
    await client.patch(f"{API}/users/{emp['user']['id']}", json={"status": "inactive"}, headers=admin_headers)
    r = await _bad_login(client, emp["user"]["work_email"], emp["password"])
    assert r.status_code == 401 and r.json()["error"]["code"] == "INACTIVE_ACCOUNT"


# ---------------- authentication of requests ----------------
async def test_missing_and_invalid_bearer(client):
    r = await client.get(f"{API}/auth/me")
    assert r.status_code == 401 and r.json()["error"]["code"] == "NOT_AUTHENTICATED"
    assert r.headers["www-authenticate"] == "Bearer"
    r = await client.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "INVALID_TOKEN"
    r = await client.get(f"{API}/auth/me", headers={"Authorization": "Basic abc"})
    assert r.status_code == 401


async def test_me_hides_private_fields(client, admin_headers):
    body = (await client.get(f"{API}/auth/me", headers=admin_headers)).json()
    assert body["role"] == "admin" and body["employee_id"] == "ADMIN"
    for k in ("password_hash", "failed_login_count", "locked_until", "token_version", "_id"):
        assert k not in body


# ---------------- refresh / logout ----------------
async def test_refresh_rotates_and_reuse_revokes_family(client, make_employee):
    emp = await make_employee()
    t0 = await login(client, emp["user"]["work_email"], emp["password"])
    r1 = await client.post(f"{API}/auth/refresh", json={"refresh_token": t0["refresh_token"]})
    assert r1.status_code == 200
    t1 = r1.json()
    assert t1["refresh_token"] != t0["refresh_token"]
    assert (await client.get(f"{API}/auth/me", headers=bearer(t1))).status_code == 200

    reuse = await client.post(f"{API}/auth/refresh", json={"refresh_token": t0["refresh_token"]})
    assert reuse.status_code == 401 and reuse.json()["error"]["code"] == "INVALID_REFRESH_TOKEN"
    # the whole family is now dead, including the freshly issued token
    assert (await client.post(f"{API}/auth/refresh", json={"refresh_token": t1["refresh_token"]})).status_code == 401


async def test_refresh_unknown_and_expired(client, db, make_employee):
    assert (await client.post(f"{API}/auth/refresh", json={"refresh_token": "nope"})).status_code == 401
    emp = await make_employee()
    t = await login(client, emp["user"]["work_email"], emp["password"])
    await db.refresh_tokens.update_many({}, {"$set": {"expires_at": utcnow() - timedelta(days=1)}})
    assert (await client.post(f"{API}/auth/refresh", json={"refresh_token": t["refresh_token"]})).status_code == 401


async def test_logout_revokes_refresh_token(client, make_employee):
    emp = await make_employee()
    t = await login(client, emp["user"]["work_email"], emp["password"])
    assert (await client.post(f"{API}/auth/logout", json={"refresh_token": t["refresh_token"]})).status_code == 200
    assert (await client.post(f"{API}/auth/refresh", json={"refresh_token": t["refresh_token"]})).status_code == 401


async def test_logout_is_safe_without_or_with_unknown_token(client):
    assert (await client.post(f"{API}/auth/logout", json={})).status_code == 200
    assert (await client.post(f"{API}/auth/logout", json={"refresh_token": "unknown"})).status_code == 200


async def test_deactivation_kills_access_and_refresh_tokens(client, make_employee, admin_headers):
    emp = await make_employee()
    t = await login(client, emp["user"]["work_email"], emp["password"])
    await client.patch(f"{API}/users/{emp['user']['id']}", json={"status": "inactive"}, headers=admin_headers)
    assert (await client.get(f"{API}/auth/me", headers=bearer(t))).status_code == 401
    assert (await client.post(f"{API}/auth/refresh", json={"refresh_token": t["refresh_token"]})).status_code == 401


# ---------------- change password ----------------
async def test_change_password_flow(client, make_employee):
    emp = await make_employee()
    old = await login(client, emp["user"]["work_email"], emp["password"])
    r = await client.post(f"{API}/auth/change-password", headers=bearer(old),
                          json={"current_password": emp["password"], "new_password": NEW_PASSWORD})
    assert r.status_code == 200
    fresh = r.json()
    assert (await client.get(f"{API}/auth/me", headers=bearer(old))).json()["error"]["code"] == "TOKEN_REVOKED"
    assert (await client.get(f"{API}/auth/me", headers=bearer(fresh))).status_code == 200
    assert (await client.post(f"{API}/auth/refresh", json={"refresh_token": old["refresh_token"]})).status_code == 401
    assert (await _bad_login(client, emp["user"]["work_email"], emp["password"])).status_code == 401
    await login(client, emp["user"]["work_email"], NEW_PASSWORD)


@pytest.mark.parametrize("current,new,code", [
    ("WrongCurrent1", NEW_PASSWORD, "INVALID_CURRENT_PASSWORD"),
    (EMPLOYEE_PASSWORD, EMPLOYEE_PASSWORD, "SAME_PASSWORD"),
    (EMPLOYEE_PASSWORD, "weak", "WEAK_PASSWORD"),
])
async def test_change_password_errors(client, make_employee, current, new, code):
    emp = await make_employee()
    r = await client.post(f"{API}/auth/change-password", headers=emp["headers"],
                          json={"current_password": current, "new_password": new})
    assert r.status_code == 422 and r.json()["error"]["code"] == code


async def test_change_password_requires_auth(client):
    r = await client.post(f"{API}/auth/change-password", json={"current_password": "a", "new_password": "b"})
    assert r.status_code == 401


# ---------------- forgot / reset ----------------
async def test_forgot_password_is_generic(client, db, make_employee):
    emp = await make_employee()
    known = await client.post(f"{API}/auth/forgot-password", json={"email": emp["user"]["work_email"]})
    unknown = await client.post(f"{API}/auth/forgot-password", json={"email": "ghost@kxn.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert await db.password_resets.count_documents({}) == 1  # only the real account got a token


async def test_forgot_password_invalidates_previous_tokens(client, db, make_employee):
    emp = await make_employee()
    for _ in range(2):
        await client.post(f"{API}/auth/forgot-password", json={"email": emp["user"]["work_email"]})
    assert await db.password_resets.count_documents({"used": False}) == 1


async def _seed_reset(db, user_id, **over):
    from bson import ObjectId
    raw, hashed = new_opaque_token()
    await db.password_resets.insert_one({
        "user_id": ObjectId(user_id), "token_hash": hashed, "used": False,
        "expires_at": utcnow() + timedelta(minutes=30), "created_at": utcnow(), "updated_at": utcnow(), **over,
    })
    return raw


async def test_reset_password_happy_path_and_single_use(client, db, make_employee):
    emp = await make_employee()
    old = await login(client, emp["user"]["work_email"], emp["password"])
    raw = await _seed_reset(db, emp["user"]["id"])
    r = await client.post(f"{API}/auth/reset-password", json={"token": raw, "new_password": NEW_PASSWORD})
    assert r.status_code == 200
    await login(client, emp["user"]["work_email"], NEW_PASSWORD)
    assert (await client.get(f"{API}/auth/me", headers=bearer(old))).status_code == 401  # sessions revoked
    again = await client.post(f"{API}/auth/reset-password", json={"token": raw, "new_password": "AnotherPass1"})
    assert again.status_code == 422 and again.json()["error"]["code"] == "INVALID_RESET_TOKEN"


async def test_reset_password_expired_unknown_and_weak(client, db, make_employee):
    emp = await make_employee()
    expired = await _seed_reset(db, emp["user"]["id"], expires_at=utcnow() - timedelta(minutes=1))
    for tok in (expired, "unknown-token"):
        r = await client.post(f"{API}/auth/reset-password", json={"token": tok, "new_password": NEW_PASSWORD})
        assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_RESET_TOKEN"
    r = await client.post(f"{API}/auth/reset-password", json={"token": "x", "new_password": "weak"})
    assert r.json()["error"]["code"] == "WEAK_PASSWORD"


async def test_reset_password_clears_lockout(client, db, make_employee):
    emp = await make_employee()
    for _ in range(settings.LOGIN_MAX_FAILURES):
        await _bad_login(client, emp["user"]["work_email"])
    raw = await _seed_reset(db, emp["user"]["id"])
    await client.post(f"{API}/auth/reset-password", json={"token": raw, "new_password": NEW_PASSWORD})
    await login(client, emp["user"]["work_email"], NEW_PASSWORD)


# ---------------- rate limits ----------------
async def test_login_rate_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    for _ in range(10):
        assert (await _bad_login(client, "ghost@kxn.com")).status_code == 401
    r = await _bad_login(client, "ghost@kxn.com")
    assert r.status_code == 429 and r.json()["error"]["code"] == "RATE_LIMITED"
    assert int(r.headers["retry-after"]) >= 1


async def test_signup_rate_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    for i in range(5):
        r = await client.post(f"{API}/auth/signup", json={"work_email": f"r{i}@kxn.com", "full_name": "R", "password": "StrongPass123"})
        assert r.status_code == 201
    r = await client.post(f"{API}/auth/signup", json={"work_email": "r9@kxn.com", "full_name": "R", "password": "StrongPass123"})
    assert r.status_code == 429
