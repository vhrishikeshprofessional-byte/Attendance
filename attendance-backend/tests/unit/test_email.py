from unittest.mock import AsyncMock

from app.config import settings
from app.services import email as mail


async def test_skipped_without_smtp_host(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    assert await mail.send_email("a@kxn.com", "s", "b") is False


async def test_sends_via_smtp(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")
    send = AsyncMock(return_value=None)
    monkeypatch.setattr("app.services.email.aiosmtplib.send", send)
    assert await mail.send_email("a@kxn.com", "Subject", "Body") is True
    msg = send.call_args.args[0]
    assert msg["To"] == "a@kxn.com" and msg["Subject"] == "Subject" and msg["From"] == settings.SMTP_FROM
    assert send.call_args.kwargs["hostname"] == "smtp.test"
    assert send.call_args.kwargs["port"] == settings.SMTP_PORT
    assert send.call_args.kwargs["start_tls"] is settings.SMTP_USE_TLS


async def test_html_alternative_attached(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")
    send = AsyncMock(return_value=None)
    monkeypatch.setattr("app.services.email.aiosmtplib.send", send)
    await mail.send_email("a@kxn.com", "S", "plain", "<p>html</p>")
    assert send.call_args.args[0].is_multipart()


async def test_smtp_failure_returns_false(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")
    monkeypatch.setattr("app.services.email.aiosmtplib.send", AsyncMock(side_effect=OSError("down")))
    assert await mail.send_email("a@kxn.com", "s", "b") is False


async def test_password_reset_email_has_link(monkeypatch):
    sent = AsyncMock(return_value=True)
    monkeypatch.setattr(mail, "send_email", sent)
    assert await mail.send_password_reset("a@kxn.com", "Asha", "tok-en_1") is True
    to, subject, body = sent.call_args.args
    assert to == "a@kxn.com" and "Reset" in subject
    assert f"{settings.FRONTEND_RESET_URL}?token=tok-en_1" in body
    assert str(settings.RESET_TOKEN_MINUTES) in body
