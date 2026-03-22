import base64
import binascii

from fastapi import Request

from ..core.auth_tokens import extract_bearer_token
from ..core.exceptions import AuthenticationError, ForbiddenError
from ..repositories.platform_repository import PlatformRepository

from ..services.current_user_service import CurrentUserContext, CurrentUserService


current_user_service = CurrentUserService()


def get_current_user_context(request: Request) -> CurrentUserContext:
    return current_user_service.resolve_current_user(
        request.headers.get("Authorization"),
        request.headers.get("X-User-Id"),
    )


def get_authenticated_user_context(request: Request) -> CurrentUserContext:
    return current_user_service.resolve_authenticated_user(
        request.headers.get("Authorization"),
    )


def get_authenticated_admin_context(request: Request) -> CurrentUserContext:
    authorization = request.headers.get("Authorization")
    bearer_token = extract_bearer_token(authorization)

    if bearer_token:
        current_user = current_user_service.resolve_authenticated_user(authorization)
    elif authorization and authorization.lower().startswith("basic "):
        encoded_credentials = authorization.split(" ", 1)[1].strip()
        try:
            decoded_credentials = base64.b64decode(encoded_credentials).decode("utf-8")
            username, password = decoded_credentials.split(":", 1)
        except (ValueError, UnicodeDecodeError, binascii.Error) as error:
            raise AuthenticationError("Invalid Basic authorization header") from error

        user = PlatformRepository().verify_credentials_and_get_user(username, password)
        current_user = CurrentUserContext(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            university_id=user["university"]["id"],
            dormitory_id=None if user["dormitory"] is None else user["dormitory"]["id"],
            is_blocked=False,
        )
    else:
        raise AuthenticationError("Authorization header with Bearer token or Basic credentials is required")

    if current_user.role != "admin":
        raise ForbiddenError("Доступно только администратору")

    return current_user
