import asyncio

from fastapi import APIRouter, Depends, Query, Request, WebSocket, WebSocketDisconnect

from .dependencies import current_user_service, get_current_user_context
from ..schemas.notification import (
    NotificationListResponse,
    NotificationPreferencesResponse,
    NotificationPreferencesUpdateRequest,
    NotificationResponse,
    NotificationUnreadCountResponse,
    StatusResponse,
    WebPushSubscriptionRequest,
)
from ..services.current_user_service import CurrentUserContext
from ..services.notification_service import NotificationService


router = APIRouter(tags=["notifications"])
notification_service = NotificationService()


@router.get("/api/v1/notifications", response_model=NotificationListResponse)
def list_notifications(
    status: str = Query(default="all"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> NotificationListResponse:
    return NotificationListResponse.model_validate(
        notification_service.list_notifications(
            current_user=current_user,
            status=status,
            limit=limit,
            offset=offset,
        )
    )


@router.get("/api/v1/notifications/unread-count", response_model=NotificationUnreadCountResponse)
def unread_count(
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> NotificationUnreadCountResponse:
    return NotificationUnreadCountResponse.model_validate(
        notification_service.unread_count(current_user=current_user)
    )


@router.post("/api/v1/notifications/{notification_id}/read", response_model=StatusResponse)
def mark_notification_read(
    notification_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> StatusResponse:
    return StatusResponse.model_validate(
        notification_service.mark_read(notification_id=notification_id, current_user=current_user)
    )


@router.post("/api/v1/notifications/read-all", response_model=StatusResponse)
def mark_all_notifications_read(
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> StatusResponse:
    return StatusResponse.model_validate(notification_service.mark_all_read(current_user=current_user))


@router.get("/api/v1/me/notification-preferences", response_model=NotificationPreferencesResponse)
def get_notification_preferences(
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> NotificationPreferencesResponse:
    return NotificationPreferencesResponse.model_validate(
        notification_service.get_preferences(current_user=current_user)
    )


@router.patch("/api/v1/me/notification-preferences", response_model=NotificationPreferencesResponse)
def patch_notification_preferences(
    payload: NotificationPreferencesUpdateRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> NotificationPreferencesResponse:
    return NotificationPreferencesResponse.model_validate(
        notification_service.update_preferences(current_user=current_user, payload=payload.model_dump())
    )


@router.post("/api/v1/me/web-push-subscriptions", response_model=dict)
def save_web_push_subscription(
    payload: WebPushSubscriptionRequest,
    request: Request,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> dict:
    return notification_service.save_web_push_subscription(
        current_user=current_user,
        payload=payload.model_dump(),
        request=request,
    )


@router.delete("/api/v1/me/web-push-subscriptions/{subscription_id}", response_model=StatusResponse)
def delete_web_push_subscription(
    subscription_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> StatusResponse:
    return StatusResponse.model_validate(
        notification_service.delete_web_push_subscription(
            current_user=current_user,
            subscription_id=subscription_id,
        )
    )


@router.websocket("/api/v1/ws/notifications")
async def notifications_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        current_user = current_user_service.resolve_current_user(
            raw_user_id=websocket.headers.get("x-user-id"),
            authorization=websocket.headers.get("authorization"),
        )
        last_id = 0
        while True:
            notifications = notification_service.latest_notifications(current_user=current_user, after_id=last_id)
            for notification in notifications:
                last_id = max(last_id, notification["id"])
                unread_count = notification_service.unread_count(current_user=current_user)["unread_count"]
                await websocket.send_json(
                    {
                        "event": "notification_created",
                        "notification": NotificationResponse.model_validate(notification).model_dump(mode="json"),
                        "unread_count": unread_count,
                    },
                    mode="text",
                )
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        return
