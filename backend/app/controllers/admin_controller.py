from typing import Annotated

from fastapi import APIRouter, Depends

from ..services.analytics_service import AnalyticsService
from ..services.chat_service import ChatService
from ..services.current_user_service import CurrentUserContext
from ..services.notification_service import NotificationService
from ..services.offer_service import OfferService
from ..services.report_service import ReportService
from ..services.review_service import ReviewService
from ..services.task_service import TaskService
from .dependencies import get_authenticated_admin_context


router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
task_service = TaskService()
offer_service = OfferService()
review_service = ReviewService()
report_service = ReportService()
chat_service = ChatService()
notification_service = NotificationService()
analytics_service = AnalyticsService()


@router.delete("/tasks", response_model=dict)
def delete_all_tasks(
    current_user: Annotated[CurrentUserContext, Depends(get_authenticated_admin_context)],
) -> dict:
    task_service.delete_all_tasks_as_admin(current_user)
    return {"status": "deleted"}


@router.delete("/offers", response_model=dict)
def delete_all_offers(
    current_user: Annotated[CurrentUserContext, Depends(get_authenticated_admin_context)],
) -> dict:
    offer_service.delete_all_offers_as_admin(current_user)
    return {"status": "deleted"}


@router.delete("/reviews", response_model=dict)
def delete_all_reviews(
    current_user: Annotated[CurrentUserContext, Depends(get_authenticated_admin_context)],
) -> dict:
    review_service.delete_all_reviews_as_admin(current_user)
    return {"status": "deleted"}


@router.delete("/reports", response_model=dict)
def delete_all_reports(
    current_user: Annotated[CurrentUserContext, Depends(get_authenticated_admin_context)],
) -> dict:
    report_service.delete_all_reports_as_admin(current_user)
    return {"status": "deleted"}


@router.delete("/chats", response_model=dict)
def delete_all_chats(
    current_user: Annotated[CurrentUserContext, Depends(get_authenticated_admin_context)],
) -> dict:
    chat_service.delete_all_chats_as_admin(current_user)
    return {"status": "deleted"}


@router.delete("/notifications", response_model=dict)
def delete_all_notifications(
    current_user: Annotated[CurrentUserContext, Depends(get_authenticated_admin_context)],
) -> dict:
    notification_service.delete_all_notifications_as_admin(current_user)
    return {"status": "deleted"}


@router.delete("/analytics", response_model=dict)
def delete_all_analytics(
    current_user: Annotated[CurrentUserContext, Depends(get_authenticated_admin_context)],
) -> dict:
    analytics_service.delete_all_analytics_as_admin(current_user)
    return {"status": "deleted"}
