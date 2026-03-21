import asyncio

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect

from .dependencies import current_user_service, get_current_user_context
from ..schemas.chat import ChatMessageResponse, ChatResponse, SendMessageRequest
from ..schemas.notification import StatusResponse
from ..services.chat_service import ChatService
from ..services.current_user_service import CurrentUserContext


router = APIRouter(tags=["chats"])
chat_service = ChatService()


@router.get("/api/v1/chats", response_model=list[ChatResponse])
def list_chats(current_user: CurrentUserContext = Depends(get_current_user_context)) -> list[ChatResponse]:
    return [ChatResponse.model_validate(item) for item in chat_service.list_chats(current_user)]


@router.get("/api/v1/chats/{chat_id}", response_model=ChatResponse)
def get_chat(
    chat_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> ChatResponse:
    return ChatResponse.model_validate(chat_service.get_chat(chat_id=chat_id, current_user=current_user))


@router.get("/api/v1/chats/{chat_id}/messages", response_model=list[ChatMessageResponse])
def list_messages(
    chat_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    before_message_id: int | None = None,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> list[ChatMessageResponse]:
    return [
        ChatMessageResponse.model_validate(item)
        for item in chat_service.list_messages(
            chat_id=chat_id,
            limit=limit,
            before_message_id=before_message_id,
            current_user=current_user,
        )
    ]


@router.post("/api/v1/chats/{chat_id}/messages", response_model=ChatMessageResponse)
def send_message(
    chat_id: int,
    payload: SendMessageRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> ChatMessageResponse:
    return ChatMessageResponse.model_validate(
        chat_service.send_message(chat_id=chat_id, body=payload.body, current_user=current_user)
    )


@router.post("/api/v1/chats/{chat_id}/read", response_model=StatusResponse)
def mark_chat_read(
    chat_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> StatusResponse:
    return StatusResponse.model_validate(chat_service.mark_chat_read(chat_id=chat_id, current_user=current_user))


@router.websocket("/api/v1/ws/chats/{chat_id}")
async def chat_ws(websocket: WebSocket, chat_id: int) -> None:
    await websocket.accept()
    try:
        current_user = current_user_service.resolve_current_user(
            raw_user_id=websocket.headers.get("x-user-id"),
            authorization=websocket.headers.get("authorization"),
        )
        last_message_id = 0
        while True:
            messages = chat_service.list_messages(
                chat_id=chat_id,
                limit=100,
                before_message_id=None,
                current_user=current_user,
            )
            new_messages = [message for message in messages if message["id"] > last_message_id]
            for message in new_messages:
                last_message_id = max(last_message_id, message["id"])
                await websocket.send_json({"event": "chat_message", "message": message}, mode="text")
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        return
