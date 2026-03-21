from datetime import datetime

from pydantic import BaseModel


class ChatParticipantResponse(BaseModel):
    id: int
    full_name: str


class ChatResponse(BaseModel):
    id: int
    task_id: int
    customer: ChatParticipantResponse
    performer: ChatParticipantResponse
    created_at: datetime
    updated_at: datetime


class ChatMessageResponse(BaseModel):
    id: int
    chat_id: int
    sender_id: int
    message_type: str
    body: str
    created_at: datetime
    read_at: datetime | None = None


class SendMessageRequest(BaseModel):
    body: str
