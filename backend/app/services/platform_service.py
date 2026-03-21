from typing import Any

from ..core.auth_tokens import create_access_token, create_refresh_token, generate_verification_code
from ..core.exceptions import AuthenticationError, DomainValidationError
from ..repositories.platform_repository import PlatformRepository
from .current_user_service import CurrentUserContext
from .email_service import EmailService


class PlatformService:
    def __init__(
        self,
        repository: PlatformRepository | None = None,
        email_service: EmailService | None = None,
    ) -> None:
        self.repository = repository or PlatformRepository()
        self.email_service = email_service or EmailService()

    def request_email_code(self, email: str) -> dict[str, Any]:
        normalized_email = email.lower().strip()

        university = self.repository.get_university_by_email(normalized_email)
        if university is None:
            raise DomainValidationError("Этот email-домен не привязан к университету")

        verification_code = generate_verification_code()
        payload = self.repository.create_email_code(normalized_email, university["id"], verification_code)

        try:
            self.email_service.send_verification_code(
                recipient_email=normalized_email,
                verification_code=verification_code,
                expires_in_sec=payload["expires_in_sec"],
            )
        except Exception:
            self.repository.invalidate_email_code(payload["id"])
            raise

        return {
            "status": payload["status"],
            "expires_in_sec": payload["expires_in_sec"],
        }

    def verify_email_code(self, email: str, code: str, *, user_agent: str | None, ip: str | None) -> dict[str, Any]:
        user = self.repository.verify_email_code_and_get_user(email, code)
        refresh_token = create_refresh_token()
        self.repository.create_refresh_session(
            user["id"],
            refresh_token,
            user_agent=user_agent,
            ip=ip,
        )

        return {
            "access_token": create_access_token(user["id"]),
            "refresh_token": refresh_token,
            "user": user,
        }

    def refresh_access_token(self, refresh_token: str | None) -> dict[str, Any]:
        if not refresh_token:
            raise AuthenticationError("Refresh token is required")

        session = self.repository.get_session_user(refresh_token)
        if session is None:
            raise AuthenticationError("Refresh token is invalid or expired")

        return {
            "access_token": create_access_token(session["user_id"]),
            "refresh_token": refresh_token,
        }

    def logout(self, refresh_token: str | None) -> dict[str, Any]:
        if refresh_token:
            self.repository.revoke_refresh_session(refresh_token)
        return {"status": "logged_out"}

    def get_me(self, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.get_me(current_user.id)

    def update_me(self, current_user: CurrentUserContext, payload: dict[str, Any]) -> dict[str, Any]:
        return self.repository.update_me(current_user.id, **payload)

    def list_dormitories(self, current_user: CurrentUserContext) -> list[dict[str, Any]]:
        return self.repository.list_dormitories(current_user.university_id)

    def get_user_profile(self, user_id: int) -> dict[str, Any]:
        return self.repository.get_user_profile(user_id)

    def list_user_reviews(self, user_id: int) -> list[dict[str, Any]]:
        return self.repository.list_user_reviews(user_id)

    def list_tasks(self, current_user: CurrentUserContext, filters: dict[str, Any], limit: int, offset: int) -> dict[str, Any]:
        return self.repository.list_tasks(
            current_user_id=current_user.id,
            current_university_id=current_user.university_id,
            current_dormitory_id=current_user.dormitory_id,
            filters=filters,
            limit=limit,
            offset=offset,
        )

    def get_task_detail(self, task_id: int, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.get_task_detail(
            task_id,
            current_user_id=current_user.id,
            current_university_id=current_user.university_id,
            current_dormitory_id=current_user.dormitory_id,
        )

    def create_task(self, current_user: CurrentUserContext, payload: dict[str, Any]) -> dict[str, Any]:
        return self.repository.create_task(
            customer_id=current_user.id,
            university_id=current_user.university_id,
            payload=payload,
        )

    def cancel_task(self, task_id: int, current_user: CurrentUserContext, reason: str) -> dict[str, Any]:
        return self.repository.cancel_task(task_id, current_user_id=current_user.id, reason=reason)

    def list_my_tasks(self, current_user: CurrentUserContext, role: str, status: str) -> list[dict[str, Any]]:
        return self.repository.list_user_tasks(current_user.id, role=role, status=status)

    def list_user_tasks(self, user_id: int, role: str, status: str) -> list[dict[str, Any]]:
        return self.repository.list_user_tasks(user_id, role=role, status=status)

    def list_task_offers(self, task_id: int, current_user: CurrentUserContext) -> list[dict[str, Any]]:
        return self.repository.list_task_offers(task_id, university_id=current_user.university_id)

    def create_offer(self, task_id: int, current_user: CurrentUserContext, payload: dict[str, Any]) -> dict[str, Any]:
        return self.repository.create_offer(
            task_id,
            performer_id=current_user.id,
            performer_university_id=current_user.university_id,
            payload=payload,
        )

    def update_offer(self, offer_id: int, current_user: CurrentUserContext, payload: dict[str, Any]) -> dict[str, Any]:
        return self.repository.update_offer(offer_id, performer_id=current_user.id, payload=payload)

    def withdraw_offer(self, offer_id: int, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.withdraw_offer(offer_id, performer_id=current_user.id)

    def accept_offer(self, offer_id: int, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.accept_offer(offer_id, customer_id=current_user.id)

    def reject_offer(self, offer_id: int, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.reject_offer(offer_id, customer_id=current_user.id)

    def list_counter_offers(self, offer_id: int, current_user: CurrentUserContext) -> list[dict[str, Any]]:
        return self.repository.list_counter_offers(offer_id, user_id=current_user.id)

    def create_counter_offer(self, offer_id: int, current_user: CurrentUserContext, payload: dict[str, Any]) -> dict[str, Any]:
        return self.repository.create_counter_offer(offer_id, author_user_id=current_user.id, payload=payload)

    def accept_counter_offer(self, counter_offer_id: int, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.accept_counter_offer(counter_offer_id, user_id=current_user.id)

    def reject_counter_offer(self, counter_offer_id: int, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.reject_counter_offer(counter_offer_id, user_id=current_user.id)

    def list_chats(self, current_user: CurrentUserContext) -> list[dict[str, Any]]:
        return self.repository.list_chats(current_user.id)

    def get_chat(self, chat_id: int, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.get_chat(chat_id, user_id=current_user.id)

    def list_chat_messages(
        self,
        chat_id: int,
        current_user: CurrentUserContext,
        *,
        limit: int,
        before_message_id: int | None,
    ) -> dict[str, Any]:
        return self.repository.list_chat_messages(
            chat_id,
            user_id=current_user.id,
            limit=limit,
            before_message_id=before_message_id,
        )

    def send_chat_message(self, chat_id: int, current_user: CurrentUserContext, body: str) -> dict[str, Any]:
        return self.repository.send_chat_message(chat_id, user_id=current_user.id, body=body)

    def mark_chat_read(self, chat_id: int, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.mark_chat_read(chat_id, user_id=current_user.id)

    def request_task_completion(self, task_id: int, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.request_task_completion(task_id, user_id=current_user.id)

    def confirm_task_completion(self, task_id: int, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.confirm_task_completion(task_id, user_id=current_user.id)

    def open_task_dispute(self, task_id: int, current_user: CurrentUserContext, comment: str) -> dict[str, Any]:
        return self.repository.open_task_dispute(task_id, user_id=current_user.id, comment=comment)

    def list_notifications(self, current_user: CurrentUserContext, status: str, limit: int, offset: int) -> dict[str, Any]:
        return self.repository.list_notifications(
            user_id=current_user.id,
            status=status,
            limit=limit,
            offset=offset,
        )

    def get_unread_notifications_count(self, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.get_unread_notifications_count(current_user.id)

    def mark_notification_read(self, notification_id: int, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.mark_notification_read(user_id=current_user.id, notification_id=notification_id)

    def mark_all_notifications_read(self, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.mark_all_notifications_read(user_id=current_user.id)

    def get_category_analytics(self, category: str, current_user: CurrentUserContext) -> dict[str, Any]:
        return self.repository.get_category_analytics(
            university_id=current_user.university_id,
            category=category,
        )
