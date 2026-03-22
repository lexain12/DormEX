from ..core.exceptions import DomainValidationError
from ..repositories.user_repository import UserRepository
from .current_user_service import CurrentUserContext


class UserService:
    def __init__(self, user_repository: UserRepository | None = None) -> None:
        self.user_repository = user_repository or UserRepository()

    def get_me(self, current_user: CurrentUserContext) -> dict:
        profile = self.user_repository.get_me_profile(current_user.id)
        if profile is None:
            raise DomainValidationError("Current user not found")
        return self._serialize_me(profile, current_user.email)

    def update_me(self, *, current_user: CurrentUserContext, payload: dict) -> dict:
        profile = self.user_repository.update_me_profile(
            user_id=current_user.id,
            full_name=payload["full_name"],
            dormitory_id=payload.get("dormitory_id"),
            room_label=payload.get("room_label"),
            bio=payload.get("bio"),
        )
        if profile is None:
            raise DomainValidationError("Dormitory must belong to the current user university")
        return self._serialize_me(profile, current_user.email)

    def list_dormitories(self, current_user: CurrentUserContext) -> list[dict]:
        return self.user_repository.list_dormitories_for_university(current_user.university_id)

    def get_public_profile(self, user_id: int) -> dict | None:
        profile = self.user_repository.get_public_profile(user_id)
        if profile is None:
            return None

        badges: list[str] = []
        if profile["email_verified_at"] is not None:
            badges.append("verified_user")
        if profile["completed_tasks_count"] >= 5:
            badges.append("fast_responder")

        return {
            "id": profile["id"],
            "full_name": profile["full_name"],
            "avatar_url": profile["avatar_url"],
            "dormitory": (
                {
                    "id": profile["dormitory_id"],
                    "name": profile["dormitory_name"],
                }
                if profile["dormitory_id"] is not None
                else None
            ),
            "rating_avg": profile["rating_avg"],
            "reviews_count": profile["reviews_count"],
            "completed_tasks_count": profile["completed_tasks_count"],
            "created_tasks_count": profile["created_tasks_count"],
            "badges": badges,
        }

    def list_user_reviews(self, user_id: int) -> list[dict]:
        return self.user_repository.list_user_reviews(user_id)

    def list_user_tasks(self, *, user_id: int, role: str, status: str | None) -> list[dict]:
        return self.user_repository.list_user_tasks(user_id=user_id, role=role, status=status)

    def _serialize_me(self, profile: dict, email: str) -> dict:
        return {
            "id": profile["id"],
            "email": email,
            "full_name": profile["full_name"],
            "avatar_url": profile["avatar_url"],
            "role": profile["role"],
            "university": {
                "id": profile["university_id"],
                "name": profile["university_name"],
            },
            "dormitory": (
                {
                    "id": profile["dormitory_id"],
                    "name": profile["dormitory_name"],
                }
                if profile["dormitory_id"] is not None
                else None
            ),
            "room_label": profile["room_label"],
            "bio": profile["bio"],
            "profile_completed": bool(profile["full_name"] and profile["dormitory_id"]),
        }
