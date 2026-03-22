from dataclasses import dataclass

from ..core.auth_tokens import decode_access_token, extract_bearer_token
from ..core.exceptions import AuthenticationError, DomainValidationError
from ..repositories.user_repository import UserRepository


@dataclass(frozen=True)
class CurrentUserContext:
    id: int
    email: str
    full_name: str
    role: str
    university_id: int
    dormitory_id: int | None
    is_blocked: bool


class CurrentUserService:
    def __init__(self, user_repository: UserRepository | None = None) -> None:
        self.user_repository = user_repository or UserRepository()

    def _build_current_user_context(self, user_id: int) -> CurrentUserContext:
        user = self.user_repository.get_user_context(user_id)
        if user is None:
            raise DomainValidationError("Current user not found")
        if user["is_blocked"]:
            raise DomainValidationError("Current user is blocked")

        return CurrentUserContext(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            university_id=user["university_id"],
            dormitory_id=user["dormitory_id"],
            is_blocked=user["is_blocked"],
        )

    def resolve_current_user(
        self,
        raw_authorization: str | None,
    ) -> CurrentUserContext:
        bearer_token = extract_bearer_token(raw_authorization)
        if not bearer_token:
            raise AuthenticationError("Authorization header with Bearer token is required")

        user_id = decode_access_token(bearer_token)
        return self._build_current_user_context(user_id)

    def resolve_authenticated_user(self, raw_authorization: str | None) -> CurrentUserContext:
        return self.resolve_current_user(raw_authorization)
