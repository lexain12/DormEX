from ..core.exceptions import DomainValidationError
from ..repositories.chat_repository import ChatRepository
from ..repositories.notification_repository import NotificationRepository
from .current_user_service import CurrentUserContext


class ChatService:
    def __init__(
        self,
        chat_repository: ChatRepository | None = None,
        notification_repository: NotificationRepository | None = None,
    ) -> None:
        self.chat_repository = chat_repository or ChatRepository()
        self.notification_repository = notification_repository or NotificationRepository()

    def list_chats(self, current_user: CurrentUserContext) -> list[dict]:
        return self.chat_repository.list_chats(user_id=current_user.id)

    def get_chat(self, *, chat_id: int, current_user: CurrentUserContext) -> dict:
        chat = self.chat_repository.get_chat(chat_id)
        if chat is None:
            raise DomainValidationError("Chat not found")
        self._ensure_chat_participant(chat, current_user.id)
        return chat

    def list_messages(
        self,
        *,
        chat_id: int,
        limit: int,
        before_message_id: int | None,
        current_user: CurrentUserContext,
    ) -> list[dict]:
        chat = self.get_chat(chat_id=chat_id, current_user=current_user)
        return self.chat_repository.list_messages(
            chat_id=chat["id"],
            limit=limit,
            before_message_id=before_message_id,
        )

    def send_message(self, *, chat_id: int, body: str, current_user: CurrentUserContext) -> dict:
        chat = self.get_chat(chat_id=chat_id, current_user=current_user)
        message = self.chat_repository.create_message(chat_id=chat_id, sender_id=current_user.id, body=body)

        target_user_id = chat["performer"]["id"] if chat["customer"]["id"] == current_user.id else chat["customer"]["id"]
        self.notification_repository.create_notification(
            user_id=target_user_id,
            notification_type="chat_message_received",
            title="Новое сообщение",
            body=f"{current_user.full_name} написал в чате",
            entity_type="chat",
            entity_id=chat_id,
            payload={"chat_id": chat_id, "task_id": chat["task_id"]},
        )
        return message

    def mark_chat_read(self, *, chat_id: int, current_user: CurrentUserContext) -> dict:
        chat = self.get_chat(chat_id=chat_id, current_user=current_user)
        self.chat_repository.mark_chat_read(chat_id=chat["id"], current_user_id=current_user.id)
        return {"status": "ok"}

    def _ensure_chat_participant(self, chat: dict, user_id: int) -> None:
        if user_id not in (chat["customer"]["id"], chat["performer"]["id"]):
            raise DomainValidationError("Access denied to chat")
