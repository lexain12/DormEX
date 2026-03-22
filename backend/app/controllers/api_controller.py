import asyncio
import hashlib
import json
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, WebSocket, WebSocketDisconnect

from ..core.auth_tokens import extract_bearer_token
from ..schemas.api import (
    AdminCreateRequest,
    AdminDeleteUserResponse,
    CancelTaskRequest,
    ChatMessageRequest,
    CreateCounterOfferRequest,
    CreateOfferRequest,
    CreateTaskReviewRequest,
    CreateTaskRequest,
    EmailCodeRequest,
    EmailCodeVerifyRequest,
    LoginRequest,
    OpenDisputeRequest,
    RefreshTokenRequest,
    RegisterRequest,
    UpdateMeRequest,
    UpdateOfferRequest,
)
from ..services.current_user_service import CurrentUserContext
from ..services.platform_service import PlatformService
from .dependencies import (
    current_user_service,
    get_authenticated_admin_context,
    get_current_user_context,
)


router = APIRouter(prefix="/api/v1")
platform_service = PlatformService()
REALTIME_POLL_INTERVAL_SECONDS = 2


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, Decimal):
        return float(value)

    return str(value)


def _snapshot_signature(payload: Any) -> str:
    serialized = json.dumps(
        payload,
        sort_keys=True,
        ensure_ascii=True,
        default=_json_default,
        separators=(",", ":"),
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _json_compatible(payload: Any) -> Any:
    return json.loads(json.dumps(payload, default=_json_default))


def _resolve_websocket_user(
    websocket: WebSocket,
    *,
    access_token: str | None,
    user_id: str | None,
) -> CurrentUserContext:
    authorization = websocket.headers.get("Authorization")
    if authorization is None and access_token:
        authorization = f"Bearer {access_token}"

    resolved_user_id = user_id or websocket.headers.get("X-User-Id")
    return current_user_service.resolve_current_user(authorization, resolved_user_id)


async def _poll_realtime_snapshot(
    websocket: WebSocket,
    *,
    get_snapshot,
    get_event,
) -> None:
    last_signature: str | None = None

    while True:
        snapshot = get_snapshot()
        signature = _snapshot_signature(snapshot)

        if last_signature is None:
            last_signature = signature
        elif signature != last_signature:
            last_signature = signature
            await websocket.send_json(_json_compatible(get_event(snapshot)), mode="text")

        await asyncio.sleep(REALTIME_POLL_INTERVAL_SECONDS)


@router.post("/auth/email/request-code", tags=["auth"])
def request_email_code(payload: EmailCodeRequest) -> dict:
    return platform_service.request_email_code(payload.email)


@router.post("/auth/email/verify-code", tags=["auth"])
def verify_email_code(payload: EmailCodeVerifyRequest, request: Request) -> dict:
    return platform_service.verify_email_code(
        payload.email,
        payload.code,
        user_agent=request.headers.get("User-Agent"),
        ip=request.client.host if request.client else None,
    )


@router.post("/auth/login", tags=["auth"])
def login(payload: LoginRequest, request: Request) -> dict:
    return platform_service.login(
        payload.username,
        payload.password,
        user_agent=request.headers.get("User-Agent"),
        ip=request.client.host if request.client else None,
    )


@router.post("/auth/register", tags=["auth"])
def register(payload: RegisterRequest, request: Request) -> dict:
    return platform_service.register(
        email=payload.email,
        username=payload.username,
        password=payload.password,
        dormitory_id=payload.dormitory_id,
        full_name=payload.full_name,
        user_agent=request.headers.get("User-Agent"),
        ip=request.client.host if request.client else None,
    )


@router.get("/auth/dormitories", tags=["auth"])
def list_registration_dormitories(email: str = Query(..., min_length=3)) -> list[dict]:
    return platform_service.list_dormitories_by_email(email)


@router.post("/admin/accounts", tags=["admin"], include_in_schema=True)
def create_admin_account(
    payload: AdminCreateRequest,
    current_user: Annotated[CurrentUserContext, Depends(get_authenticated_admin_context)],
) -> dict:
    return platform_service.create_admin_account(
        current_user=current_user,
        email=payload.email,
        username=payload.username,
        password=payload.password,
        full_name=payload.full_name,
    )


@router.delete(
    "/admin/users/{user_id}",
    tags=["admin"],
    response_model=AdminDeleteUserResponse,
    summary="Удалить пользователя по идентификатору",
    description=(
        "Полностью удаляет пользователя и связанные сущности из системы. "
        "Доступно только аутентифицированному администратору."
    ),
)
def delete_user_as_admin(
    user_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_authenticated_admin_context)],
) -> AdminDeleteUserResponse:
    return AdminDeleteUserResponse.model_validate(
        platform_service.delete_user_as_admin(
            current_user=current_user,
            user_id=user_id,
        )
    )


@router.post("/auth/refresh", tags=["auth"])
def refresh_auth_token(payload: RefreshTokenRequest, request: Request) -> dict:
    refresh_token = extract_bearer_token(request.headers.get("Authorization")) or payload.refresh_token
    return platform_service.refresh_access_token(refresh_token)


@router.post("/auth/logout", tags=["auth"])
def logout(request: Request) -> dict:
    refresh_token = extract_bearer_token(request.headers.get("Authorization"))
    return platform_service.logout(refresh_token)


@router.get("/me", tags=["profile"])
def get_me(
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.get_me(current_user)


@router.patch("/me", tags=["profile"])
def update_me(
    payload: UpdateMeRequest,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.update_me(current_user, payload.model_dump())


@router.get("/reference/dormitories", tags=["reference"])
def list_dormitories(
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> list[dict]:
    return platform_service.list_dormitories(current_user)


@router.get("/users/{user_id}", tags=["users"])
def get_user_profile(
    user_id: int,
    _: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.get_user_profile(user_id)


@router.get("/users/{user_id}/reviews", tags=["users"])
def list_user_reviews(
    user_id: int,
    _: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> list[dict]:
    return platform_service.list_user_reviews(user_id)


@router.get("/users/{user_id}/tasks", tags=["users"])
def list_user_tasks(
    user_id: int,
    role: str = Query(default="customer"),
    status: str = Query(default="active"),
    _: Annotated[CurrentUserContext, Depends(get_current_user_context)] = None,
) -> list[dict]:
    return platform_service.list_user_tasks(user_id, role, status)


@router.get("/tasks", tags=["tasks"])
def list_tasks(
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    scope: str | None = None,
    dormitory_id: int | None = None,
    category: str | None = None,
    status: str | None = None,
    urgency: str | None = None,
    payment_type: str | None = None,
    search: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    return platform_service.list_tasks(
        current_user,
        {
            "scope": scope,
            "dormitory_id": dormitory_id,
            "category": category,
            "status": status,
            "urgency": urgency,
            "payment_type": payment_type,
            "search": search,
        },
        limit,
        offset,
    )


@router.post("/tasks", tags=["tasks"])
def create_task(
    payload: CreateTaskRequest,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.create_task(current_user, payload.model_dump())


@router.get("/tasks/{task_id}", tags=["tasks"])
def get_task_detail(
    task_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.get_task_detail(task_id, current_user)


@router.post("/tasks/{task_id}/cancel", tags=["tasks"])
def cancel_task(
    task_id: int,
    payload: CancelTaskRequest,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.cancel_task(task_id, current_user, payload.reason)


@router.get("/me/tasks", tags=["profile"])
def list_my_tasks(
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    role: str = Query(default="customer"),
    status: str = Query(default="active"),
) -> list[dict]:
    return platform_service.list_my_tasks(current_user, role, status)


@router.get("/tasks/{task_id}/offers", tags=["offers"])
def list_task_offers(
    task_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> list[dict]:
    return platform_service.list_task_offers(task_id, current_user)


@router.post("/tasks/{task_id}/offers", tags=["offers"])
def create_offer(
    task_id: int,
    payload: CreateOfferRequest,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.create_offer(task_id, current_user, payload.model_dump())


@router.patch("/offers/{offer_id}", tags=["offers"])
def update_offer(
    offer_id: int,
    payload: UpdateOfferRequest,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.update_offer(offer_id, current_user, payload.model_dump())


@router.post("/offers/{offer_id}/withdraw", tags=["offers"])
def withdraw_offer(
    offer_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.withdraw_offer(offer_id, current_user)


@router.post("/offers/{offer_id}/accept", tags=["offers"])
def accept_offer(
    offer_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.accept_offer(offer_id, current_user)


@router.post("/offers/{offer_id}/reject", tags=["offers"])
def reject_offer(
    offer_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.reject_offer(offer_id, current_user)


@router.get("/offers/{offer_id}/counter-offers", tags=["offers"])
def list_counter_offers(
    offer_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> list[dict]:
    return platform_service.list_counter_offers(offer_id, current_user)


@router.post("/offers/{offer_id}/counter-offers", tags=["offers"])
def create_counter_offer(
    offer_id: int,
    payload: CreateCounterOfferRequest,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.create_counter_offer(offer_id, current_user, payload.model_dump())


@router.post("/counter-offers/{counter_offer_id}/accept", tags=["offers"])
def accept_counter_offer(
    counter_offer_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.accept_counter_offer(counter_offer_id, current_user)


@router.post("/counter-offers/{counter_offer_id}/reject", tags=["offers"])
def reject_counter_offer(
    counter_offer_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.reject_counter_offer(counter_offer_id, current_user)


@router.get("/chats", tags=["chats"])
def list_chats(
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> list[dict]:
    return platform_service.list_chats(current_user)


@router.get("/chats/{chat_id}", tags=["chats"])
def get_chat(
    chat_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.get_chat(chat_id, current_user)


@router.get("/chats/{chat_id}/messages", tags=["chats"])
def list_chat_messages(
    chat_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    limit: int = Query(default=50, ge=1, le=100),
    before_message_id: int | None = None,
) -> dict:
    return platform_service.list_chat_messages(
        chat_id,
        current_user,
        limit=limit,
        before_message_id=before_message_id,
    )


@router.post("/chats/{chat_id}/messages", tags=["chats"])
def send_chat_message(
    chat_id: int,
    payload: ChatMessageRequest,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.send_chat_message(chat_id, current_user, payload.body)


@router.post("/chats/{chat_id}/read", tags=["chats"])
def mark_chat_read(
    chat_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.mark_chat_read(chat_id, current_user)


@router.post("/tasks/{task_id}/complete-request", tags=["tasks"])
def request_task_completion(
    task_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.request_task_completion(task_id, current_user)


@router.post("/tasks/{task_id}/confirm-completion", tags=["tasks"])
def confirm_task_completion(
    task_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.confirm_task_completion(task_id, current_user)


@router.post("/tasks/{task_id}/open-dispute", tags=["tasks"])
def open_task_dispute(
    task_id: int,
    payload: OpenDisputeRequest,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.open_task_dispute(task_id, current_user, payload.comment)


@router.get("/tasks/{task_id}/reviews")
def list_task_reviews(
    task_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> list[dict]:
    return platform_service.list_task_reviews(task_id, current_user)


@router.post("/tasks/{task_id}/reviews")
def create_task_review(
    task_id: int,
    payload: CreateTaskReviewRequest,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.create_task_review(task_id, current_user, payload.model_dump())

@router.get("/notifications", tags=["notifications"])
def list_notifications(
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    status: str = Query(default="all"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    return platform_service.list_notifications(current_user, status, limit, offset)


@router.get("/notifications/unread-count", tags=["notifications"])
def unread_notifications_count(
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.get_unread_notifications_count(current_user)


@router.post("/notifications/{notification_id}/read", tags=["notifications"])
def mark_notification_read(
    notification_id: int,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.mark_notification_read(notification_id, current_user)


@router.post("/notifications/read-all", tags=["notifications"])
def mark_all_notifications_read(
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.mark_all_notifications_read(current_user)


@router.get("/analytics/categories/{category}", tags=["analytics"])
def get_category_analytics(
    category: str,
    current_user: Annotated[CurrentUserContext, Depends(get_current_user_context)],
) -> dict:
    return platform_service.get_category_analytics(category, current_user)


@router.websocket("/ws/notifications")
async def notifications_ws(
    websocket: WebSocket,
    access_token: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
) -> None:
    await websocket.accept()

    try:
        current_user = _resolve_websocket_user(
            websocket,
            access_token=access_token,
            user_id=user_id,
        )
        await _poll_realtime_snapshot(
            websocket,
            get_snapshot=lambda: platform_service.list_notifications(current_user, "all", 20, 0),
            get_event=lambda snapshot: {
                "event": "notifications_updated",
                "items": snapshot["items"],
                "unread_count": snapshot["unread_count"],
            },
        )
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=1011)


@router.websocket("/ws/tasks")
async def tasks_ws(
    websocket: WebSocket,
    access_token: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
) -> None:
    await websocket.accept()

    try:
        current_user = _resolve_websocket_user(
            websocket,
            access_token=access_token,
            user_id=user_id,
        )
        await _poll_realtime_snapshot(
            websocket,
            get_snapshot=lambda: platform_service.list_tasks(current_user, {}, limit=100, offset=0),
            get_event=lambda snapshot: {
                "event": "tasks_updated",
                "total": snapshot["total"],
            },
        )
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=1011)


@router.websocket("/ws/tasks/{task_id}")
async def task_detail_ws(
    websocket: WebSocket,
    task_id: int,
    access_token: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
) -> None:
    await websocket.accept()

    try:
        current_user = _resolve_websocket_user(
            websocket,
            access_token=access_token,
            user_id=user_id,
        )
        await _poll_realtime_snapshot(
            websocket,
            get_snapshot=lambda: {
                "task": platform_service.get_task_detail(task_id, current_user),
                "offers": platform_service.list_task_offers(task_id, current_user),
            },
            get_event=lambda snapshot: {
                "event": "task_updated",
                "task_id": task_id,
                "task": snapshot["task"],
                "offers": snapshot["offers"],
                "status": snapshot["task"].get("status"),
                "chat_id": snapshot["task"].get("chat_id"),
                "offers_count": len(snapshot["offers"]),
            },
        )
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=1011)


@router.websocket("/ws/offers/{offer_id}/counter-offers")
async def counter_offers_ws(
    websocket: WebSocket,
    offer_id: int,
    access_token: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
) -> None:
    await websocket.accept()

    try:
        current_user = _resolve_websocket_user(
            websocket,
            access_token=access_token,
            user_id=user_id,
        )
        await _poll_realtime_snapshot(
            websocket,
            get_snapshot=lambda: platform_service.list_counter_offers(offer_id, current_user),
            get_event=lambda snapshot: {
                "event": "counter_offers_updated",
                "offer_id": offer_id,
                "items": snapshot,
                "total": len(snapshot),
            },
        )
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=1011)


@router.websocket("/ws/chats/{chat_id}")
async def chat_ws(
    websocket: WebSocket,
    chat_id: int,
    access_token: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
) -> None:
    await websocket.accept()

    try:
        current_user = _resolve_websocket_user(
            websocket,
            access_token=access_token,
            user_id=user_id,
        )
        await _poll_realtime_snapshot(
            websocket,
            get_snapshot=lambda: platform_service.list_chat_messages(
                chat_id,
                current_user,
                limit=100,
                before_message_id=None,
            ),
            get_event=lambda snapshot: {
                "event": "chat_messages_updated",
                "chat_id": chat_id,
                "items": snapshot["items"],
                "last_message_id": snapshot["items"][-1]["id"] if snapshot["items"] else None,
            },
        )
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=1011)
