"""Authentication endpoints. Public credentials endpoints are rate limited per IP."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser
from app.core.rate_limit import RateLimit
from app.models.auth import (
    ChangePasswordIn,
    ForgotPasswordIn,
    LoginIn,
    LogoutIn,
    MessageOut,
    RefreshIn,
    ResetPasswordIn,
    SignupIn,
    TokenOut,
)
from app.services import auth as svc
from app.services.users import PRIVATE_FIELDS
from app.utils.serialize import doc_out

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post(
    "/signup",
    response_model=TokenOut,
    dependencies=[Depends(RateLimit("auth-signup", 5, 3600))],
    status_code=201,
)
async def signup(body: SignupIn):
    return await svc.signup(body)


@router.post(
    "/login",
    response_model=TokenOut,
    dependencies=[Depends(RateLimit("auth-login", 10, 60))],
)
async def login(body: LoginIn):
    return await svc.login(body.identifier, body.password)


@router.post(
    "/refresh",
    response_model=TokenOut,
    dependencies=[Depends(RateLimit("auth-refresh", 30, 60))],
)
async def refresh(body: RefreshIn):
    return await svc.refresh(body.refresh_token)


@router.post("/logout", response_model=MessageOut)
async def logout(body: LogoutIn):
    await svc.logout(body.refresh_token)
    return {"message": "Signed out"}


@router.post(
    "/forgot-password",
    response_model=MessageOut,
    dependencies=[Depends(RateLimit("auth-forgot", 5, 900))],
)
async def forgot_password(body: ForgotPasswordIn):
    await svc.forgot_password(str(body.email))
    return {"message": "If an account exists for that email, a reset link has been sent"}


@router.post(
    "/reset-password",
    response_model=MessageOut,
    dependencies=[Depends(RateLimit("auth-reset", 10, 900))],
)
async def reset_password(body: ResetPasswordIn):
    await svc.reset_password(body.token, body.new_password)
    return {"message": "Password has been reset. Please sign in."}


@router.post(
    "/change-password",
    response_model=TokenOut,
    dependencies=[Depends(RateLimit("auth-change", 10, 900))],
)
async def change_password(body: ChangePasswordIn, user: CurrentUser):
    return await svc.change_password(user, body.current_password, body.new_password)


@router.get("/me")
async def me(user: CurrentUser):
    return doc_out(user, drop=PRIVATE_FIELDS)
