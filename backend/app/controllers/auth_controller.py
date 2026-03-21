from fastapi import APIRouter, Depends, Header, Request

from .dependencies import get_current_user_context
from ..core.exceptions import DomainValidationError
from ..schemas.auth import (
    AuthRefreshRequest,
    AuthTokensResponse,
    EmailRequestCodeRequest,
    EmailRequestCodeResponse,
    EmailVerifyCodeRequest,
    LogoutResponse,
)
from ..services.auth_service import AuthService
from ..services.current_user_service import CurrentUserContext


router = APIRouter(tags=["auth"])
auth_service = AuthService()


@router.post("/api/v1/auth/email/request-code", response_model=EmailRequestCodeResponse)
def request_email_code(payload: EmailRequestCodeRequest) -> EmailRequestCodeResponse:
    return EmailRequestCodeResponse.model_validate(auth_service.request_code(payload.email))


@router.post("/api/v1/auth/email/verify-code", response_model=AuthTokensResponse)
def verify_email_code(payload: EmailVerifyCodeRequest, request: Request) -> AuthTokensResponse:
    return AuthTokensResponse.model_validate(
        auth_service.verify_code(email=payload.email, code=payload.code, request=request)
    )


@router.post("/api/v1/auth/refresh", response_model=AuthTokensResponse)
def refresh_tokens(payload: AuthRefreshRequest) -> AuthTokensResponse:
    return AuthTokensResponse.model_validate(auth_service.refresh(payload.refresh_token))


@router.post("/api/v1/auth/logout", response_model=LogoutResponse)
def logout(
    current_user: CurrentUserContext = Depends(get_current_user_context),
    authorization: str | None = Header(default=None),
) -> LogoutResponse:
    _ = current_user
    if authorization is None:
        raise DomainValidationError("Authorization header is required")

    access_token = authorization.split(" ", 1)[1]
    return LogoutResponse.model_validate(auth_service.logout(access_token))
