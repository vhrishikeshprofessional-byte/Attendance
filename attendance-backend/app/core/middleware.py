"""Pure-ASGI middleware: request id, client IP, body-size limit, security headers, access log.
Pure ASGI (not BaseHTTPMiddleware) so ContextVars reach the route handlers."""
from __future__ import annotations

import logging
import re
import time
import uuid

from fastapi.responses import JSONResponse

from app.config import settings
from app.core.context import client_ip_var, request_id_var
from app.core.errors import AppError

log = logging.getLogger("app.access")
_RID_RE = re.compile(r"[A-Za-z0-9._-]{8,64}")
_SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
    (b"cache-control", b"no-store"),
]


class RequestContextMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        rid = headers.get(b"x-request-id", b"").decode("latin-1")
        if not _RID_RE.fullmatch(rid):
            rid = uuid.uuid4().hex
        client = scope.get("client")
        tok_rid = request_id_var.set(rid)
        tok_ip = client_ip_var.set(client[0] if client else "-")

        status_holder = {"status": 500}
        started = time.perf_counter()

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                message = dict(message)
                extra = [(b"x-request-id", rid.encode())]
                existing = {k.lower() for k, _ in message.get("headers", [])}
                extra += [h for h in _SECURITY_HEADERS if h[0] not in existing]
                message["headers"] = list(message.get("headers", [])) + extra
            await send(message)

        max_bytes = settings.MAX_REQUEST_BYTES
        received = 0

        async def limited_receive():
            nonlocal received
            msg = await receive()
            if msg["type"] == "http.request":
                received += len(msg.get("body", b""))
                if received > max_bytes:
                    raise AppError("Request body too large", code="PAYLOAD_TOO_LARGE", status_code=413)
            return msg

        try:
            declared = headers.get(b"content-length", b"")
            if declared.isdigit() and int(declared) > max_bytes:
                body = {
                    "error": {
                        "code": "PAYLOAD_TOO_LARGE",
                        "message": "Request body too large",
                        "details": None,
                    }
                }
                await JSONResponse(body, status_code=413)(scope, receive, send_wrapper)
            else:
                await self.app(scope, limited_receive, send_wrapper)
        finally:
            log.info(
                "request",
                extra={
                    "method": scope.get("method", "-"),
                    "path": scope.get("path", "-"),
                    "status": status_holder["status"],
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                },
            )
            request_id_var.reset(tok_rid)
            client_ip_var.reset(tok_ip)
