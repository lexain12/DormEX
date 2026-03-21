from datetime import datetime
from typing import Any

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    body: str
    entity_type: str | None = None
    entity_id: int | None = None
    payload: dict[str, Any] | None = None
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int
    limit: int
    offset: int


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int


class NotificationPreferencesResponse(BaseModel):
    in_app_enabled: bool
    web_push_enabled: bool
    offers_enabled: bool
    counter_offers_enabled: bool
    chat_enabled: bool
    task_updates_enabled: bool
    reviews_enabled: bool
    moderation_enabled: bool


class NotificationPreferencesUpdateRequest(NotificationPreferencesResponse):
    pass


class WebPushSubscriptionRequest(BaseModel):
    endpoint: str
    p256dh_key: str
    auth_key: str


class StatusResponse(BaseModel):
    status: str
