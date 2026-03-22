from fastapi import Request

from ..core.exceptions import ForbiddenError
from ..repositories.notification_repository import NotificationRepository
from .current_user_service import CurrentUserContext


class NotificationService:
    def __init__(self, notification_repository: NotificationRepository | None = None) -> None:
        self.notification_repository = notification_repository or NotificationRepository()

    def list_notifications(self, *, current_user: CurrentUserContext, status: str, limit: int, offset: int) -> dict:
        return self.notification_repository.list_notifications(
            user_id=current_user.id,
            status=status,
            limit=limit,
            offset=offset,
        )

    def unread_count(self, *, current_user: CurrentUserContext) -> dict:
        return {"unread_count": self.notification_repository.get_unread_count(user_id=current_user.id)}

    def mark_read(self, *, notification_id: int, current_user: CurrentUserContext) -> dict:
        self.notification_repository.mark_read(user_id=current_user.id, notification_id=notification_id)
        return {"status": "ok"}

    def mark_all_read(self, *, current_user: CurrentUserContext) -> dict:
        self.notification_repository.mark_all_read(user_id=current_user.id)
        return {"status": "ok"}

    def get_preferences(self, *, current_user: CurrentUserContext) -> dict:
        return self.notification_repository.get_preferences(user_id=current_user.id)

    def update_preferences(self, *, current_user: CurrentUserContext, payload: dict) -> dict:
        return self.notification_repository.update_preferences(user_id=current_user.id, payload=payload)

    def save_web_push_subscription(self, *, current_user: CurrentUserContext, payload: dict, request: Request) -> dict:
        row = self.notification_repository.save_web_push_subscription(
            user_id=current_user.id,
            endpoint=payload["endpoint"],
            p256dh_key=payload["p256dh_key"],
            auth_key=payload["auth_key"],
            user_agent=request.headers.get("User-Agent"),
        )
        return {"status": "saved", "subscription_id": row["id"]}

    def delete_web_push_subscription(self, *, current_user: CurrentUserContext, subscription_id: int) -> dict:
        self.notification_repository.delete_web_push_subscription(
            user_id=current_user.id,
            subscription_id=subscription_id,
        )
        return {"status": "deleted"}

    def latest_notifications(self, *, current_user: CurrentUserContext, after_id: int | None = None) -> list[dict]:
        return self.notification_repository.list_latest_notifications(user_id=current_user.id, after_id=after_id)

    def delete_all_notifications_as_admin(self, current_user: CurrentUserContext) -> None:
        self._ensure_admin(current_user)
        self.notification_repository.delete_all_notifications()

    def _ensure_admin(self, current_user: CurrentUserContext) -> None:
        if current_user.role != "admin":
            raise ForbiddenError("Доступно только администратору")
