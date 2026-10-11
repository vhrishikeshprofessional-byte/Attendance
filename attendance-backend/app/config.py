"""Application settings. Secrets come only from environment / .env."""
from __future__ import annotations

from functools import lru_cache
from zoneinfo import ZoneInfo

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    APP_ENV: str = "local"
    SECRET_KEY: str = Field(min_length=32)
    ACCESS_TOKEN_MINUTES: int = 15
    REFRESH_TOKEN_DAYS: int = 7

    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB: str = "attendance"
    USE_TRANSACTIONS: bool = True  # needs a replica set; only disable for mock tests

    ADMIN_EMAIL: str = "admin@kxn.com"
    ADMIN_PASSWORD: str = ""

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "attendance@kxn.com"
    SMTP_USE_TLS: bool = True

    TIMEZONE: str = "Asia/Kolkata"
    WEEKLY_OFF_DAYS: str = "5,6"  # Monday=0 ... Sunday=6
    REQUIRED_DAYS: int = 3
    REQUIRED_HOURS_PER_DAY: int = 5
    MIN_ATTENDED_DAY_MINUTES: int = 60
    MAX_SESSION_HOURS: int = 16
    FUTURE_TIME_TOLERANCE_SECONDS: int = 60

    SCHEDULER_ENABLED: bool = True
    POLICY_JOB_CRON: str = "mon 09:00"
    MIDWEEK_REMINDER_CRON: str = "thu 16:00"
    ADMIN_DIGEST_ENABLED: bool = True
    MIDWEEK_REMINDER_ENABLED: bool = False

    ALLOWED_SIGNUP_DOMAINS: str = ""
    REPORT_MAX_DAYS: int = 366
    REPORT_DAILY_MAX_DAYS: int = 93

    CORS_ORIGINS: str = ""
    MAX_REQUEST_BYTES: int = 1_000_000
    PASSWORD_MIN_LENGTH: int = 10
    LOGIN_MAX_FAILURES: int = 5
    LOGIN_LOCK_MINUTES: int = 15
    RESET_TOKEN_MINUTES: int = 30
    FRONTEND_RESET_URL: str = "http://localhost:3000/reset-password"
    RATE_LIMIT_ENABLED: bool = True
    LOG_LEVEL: str = "INFO"

    @model_validator(mode="after")
    def _check_secret(self) -> Settings:
        if self.APP_ENV not in ("local", "test") and self.SECRET_KEY.lower().startswith("change-me"):
            raise ValueError("SECRET_KEY must be changed outside local/test environments")
        return self

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.TIMEZONE)

    @property
    def weekly_off_set(self) -> frozenset[int]:
        return frozenset(int(x) for x in self.WEEKLY_OFF_DAYS.split(",") if x.strip() != "")

    @property
    def signup_domains(self) -> list[str]:
        return [d.strip().lower().lstrip("@") for d in self.ALLOWED_SIGNUP_DOMAINS.split(",") if d.strip()]

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def base_working_days(self) -> int:
        return 7 - len(self.weekly_off_set)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
