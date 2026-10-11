import pytest
from pydantic import ValidationError

from app.config import Settings

KEY = "k" * 40


def make(**kw):
    return Settings(_env_file=None, SECRET_KEY=KEY, **kw)


def test_secret_key_min_length():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, SECRET_KEY="short")


def test_placeholder_secret_rejected_outside_local():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, SECRET_KEY="change-me-" + "x" * 30, APP_ENV="production")


def test_placeholder_secret_allowed_locally():
    Settings(_env_file=None, SECRET_KEY="change-me-" + "x" * 30, APP_ENV="local")


def test_weekly_off_set_and_working_days():
    s = make(WEEKLY_OFF_DAYS="5,6")
    assert s.weekly_off_set == frozenset({5, 6})
    assert s.base_working_days == 5
    assert make(WEEKLY_OFF_DAYS="6").base_working_days == 6
    assert make(WEEKLY_OFF_DAYS="").weekly_off_set == frozenset()


def test_signup_domains_normalised():
    assert make(ALLOWED_SIGNUP_DOMAINS="@KXN.com, foo.org ,").signup_domains == ["kxn.com", "foo.org"]
    assert make(ALLOWED_SIGNUP_DOMAINS="").signup_domains == []


def test_cors_list():
    assert make(CORS_ORIGINS="http://a.com, http://b.com").cors_list == ["http://a.com", "http://b.com"]
    assert make(CORS_ORIGINS="").cors_list == []


def test_timezone_property():
    assert str(make().tz) == "Asia/Kolkata"
