import base64
import binascii

from fastapi import Request

from ..core.auth_tokens import extract_bearer_token
from ..core.exceptions import AuthenticationError, ForbiddenError
from ..repositories.platform_repository import PlatformRepository

from ..services.current_user_service import CurrentUserContext, CurrentUserService


current_user_service = CurrentUserService()


def _resolve_basic_user_context(authorization: str) -> CurrentUserContext:
    if authorization.lower().startswith("basic "):
        encoded_credentials = authorization.split(" ", 1)[1].strip()
        try:
            decoded_credentials = base64.b64decode(encoded_credentials).decode("utf-8")
            username, password = decoded_credentials.split(":", 1)
        except (ValueError, UnicodeDecodeError, binascii.Error) as error:
            raise AuthenticationError("Invalid Basic authorization header") from error

        user = PlatformRepository().verify_credentials_and_get_user(username, password)
        return CurrentUserContext(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            university_id=user["university"]["id"],
            dormitory_id=None if user["dormitory"] is None else user["dormitory"]["id"],
            is_blocked=False,
        )
    raise AuthenticationError("Authorization header with Basic credentials is required")


def _resolve_request_user_context(request: Request) -> CurrentUserContext:
    authorization = request.headers.get("Authorization")
    if not authorization:
        raise AuthenticationError("Authorization header with Basic credentials or Bearer token is required")

    if authorization.lower().startswith("basic "):
        return _resolve_basic_user_context(authorization)

    bearer_token = extract_bearer_token(authorization)
    if bearer_token:
        return current_user_service.resolve_authenticated_user(authorization)

    raise AuthenticationError("Authorization header with Basic credentials or Bearer token is required")


def get_current_user_context(request: Request) -> CurrentUserContext:
    return _resolve_request_user_context(request)


def get_authenticated_user_context(request: Request) -> CurrentUserContext:
    return _resolve_request_user_context(request)


def get_authenticated_admin_context(request: Request) -> CurrentUserContext:
    current_user = _resolve_request_user_context(request)

    if current_user.role != "admin":
        raise ForbiddenError("Доступно только администратору")

    return current_user
