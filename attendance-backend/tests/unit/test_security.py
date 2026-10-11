from datetime import timedelta

import jwt
import pytest
from bson import ObjectId

from app.config import settings
from app.core.errors import Unauthorized, Unprocessable
from app.core.security import (
    ALGORITHM,
    create_access_token,
    decode_access_token,
    hash_password,
    hash_token,
    new_opaque_token,
    validate_password_policy,
    verify_password,
)
from app.utils.timefmt import utcnow


@pytest.mark.parametrize(
    "pw",
    ["Short1A", "alllowercase123", "ALLUPPERCASE123", "NoDigitsHereAtAll"],
)
def test_weak_passwords_rejected(pw):
    with pytest.raises(Unprocessable) as exc:
        validate_password_policy(pw)
    assert exc.value.code == "WEAK_PASSWORD"


def test_strong_password_accepted():
    validate_password_policy("GoodPassw0rd")


def test_password_policy_message_lists_all_problems():
    with pytest.raises(Unprocessable) as exc:
        validate_password_policy("abc")
    msg = exc.value.message
    assert "10 characters" in msg and "upper and lower" in msg and "digit" in msg


async def test_hash_and_verify_roundtrip():
    h = await hash_password("GoodPassw0rd")
    assert h != "GoodPassw0rd" and h.startswith("$argon2id$")
    assert await verify_password("GoodPassw0rd", h) is True
    assert await verify_password("WrongPassw0rd", h) is False


async def test_verify_with_no_hash_is_always_false():
    assert await verify_password("anything", None) is False
    # even the dummy password itself must never authenticate a missing user
    assert await verify_password("dummy-password-for-timing-equalisation", None) is False


async def test_verify_with_garbage_hash_is_false():
    assert await verify_password("x", "not-a-hash") is False


def test_access_token_roundtrip():
    uid = ObjectId()
    token, expires_in = create_access_token({"_id": uid, "role": "employee", "token_version": 2})
    claims = decode_access_token(token)
    assert claims["sub"] == str(uid)
    assert claims["role"] == "employee"
    assert claims["tv"] == 2
    assert expires_in == settings.ACCESS_TOKEN_MINUTES * 60
    assert claims["exp"] > claims["iat"]


def test_tokens_have_unique_jti():
    u = {"_id": ObjectId(), "role": "employee"}
    assert decode_access_token(create_access_token(u)[0])["jti"] != decode_access_token(create_access_token(u)[0])["jti"]


def test_expired_token_rejected():
    now = utcnow()
    token = jwt.encode(
        {"sub": "x", "exp": int((now - timedelta(minutes=1)).timestamp())},
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )
    with pytest.raises(Unauthorized) as exc:
        decode_access_token(token)
    assert exc.value.code == "INVALID_TOKEN"


def test_token_signed_with_other_key_rejected():
    token = jwt.encode(
        {"sub": "x", "exp": int((utcnow() + timedelta(minutes=5)).timestamp())},
        "another-secret-key-that-is-long-enough-123456",
        algorithm=ALGORITHM,
    )
    with pytest.raises(Unauthorized):
        decode_access_token(token)


def test_token_without_sub_rejected():
    token = jwt.encode(
        {"exp": int((utcnow() + timedelta(minutes=5)).timestamp())},
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )
    with pytest.raises(Unauthorized):
        decode_access_token(token)


def test_unsigned_alg_none_token_rejected():
    token = jwt.encode({"sub": "x", "exp": 9999999999}, key=None, algorithm="none")
    with pytest.raises(Unauthorized):
        decode_access_token(token)


def test_garbage_token_rejected():
    with pytest.raises(Unauthorized):
        decode_access_token("not.a.jwt")


def test_opaque_tokens():
    raw, hashed = new_opaque_token()
    assert hash_token(raw) == hashed and raw != hashed
    assert len(hashed) == 64
    assert new_opaque_token()[0] != raw
