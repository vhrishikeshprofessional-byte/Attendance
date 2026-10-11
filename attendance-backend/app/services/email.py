"""SMTP email sender. Without SMTP_HOST configured, sending is skipped (returns False)."""
from __future__ import annotations

import logging
from email.message import EmailMessage
from urllib.parse import quote

import aiosmtplib

from app.config import settings

log = logging.getLogger("app.email")


async def send_email(to: str, subject: str, body: str, html_body: str | None = None) -> bool:
    if not settings.SMTP_HOST:
        log.warning("SMTP not configured; email skipped")
        return False
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = settings.SMTP_FROM, to, subject
    msg.set_content(body)
    if html_body:
        msg.add_alternative(html_body, subtype='html')
    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME or None,
            password=settings.SMTP_PASSWORD or None,
            start_tls=settings.SMTP_USE_TLS,
            timeout=15,
        )
        return True
    except Exception:
        log.exception("email send failed")  # recipient/body deliberately not logged
        return False


async def send_password_reset(to: str, name: str, token: str) -> bool:
    link = f"{settings.FRONTEND_RESET_URL}?token={quote(token)}"
    body = (
        f"Hello {name},\n\nUse the link below to reset your password. "
        f"It expires in {settings.RESET_TOKEN_MINUTES} minutes.\n\n{link}\n\n"
        "If you did not request this, you can ignore this email.\n"
    )
    return await send_email(to, "Reset your attendance account password", body)
