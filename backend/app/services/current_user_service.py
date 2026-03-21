import os
from dataclasses import dataclass

from ..core.exceptions import DomainValidationError
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
        self.default_user_id = os.getenv("DEFAULT_USER_ID", "1")

    def resolve_current_user(self, raw_user_id: str | None) -> CurrentUserContext:
        user_id_value = raw_user_id or self.default_user_id

        try:
            user_id = int(user_id_value)
        except (TypeError, ValueError) as error:
            raise DomainValidationError("Invalid current user identifier") from error

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
