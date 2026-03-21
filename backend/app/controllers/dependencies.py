from fastapi import Request

from ..services.current_user_service import CurrentUserContext, CurrentUserService


current_user_service = CurrentUserService()


def get_current_user_context(request: Request) -> CurrentUserContext:
    return current_user_service.resolve_current_user(
        raw_user_id=request.headers.get("X-User-Id"),
        authorization=request.headers.get("Authorization"),
    )
