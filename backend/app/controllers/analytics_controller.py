from typing import Annotated

from fastapi import APIRouter, Depends

from .dependencies import get_authenticated_admin_context
from ..schemas.analytics import CategoryAnalyticsFullResponse
from ..services.analytics_service import AnalyticsService
from ..services.current_user_service import CurrentUserContext


router = APIRouter(tags=["analytics"])
analytics_service = AnalyticsService()


@router.get("/api/v1/analytics/categories/{category}", response_model=CategoryAnalyticsFullResponse)
def get_category_analytics(category: str) -> CategoryAnalyticsFullResponse:
    return CategoryAnalyticsFullResponse.model_validate(
        analytics_service.get_category_analytics(category=category)
    )


@router.delete("/admin/analytics", tags=["admin"], response_model=dict)
def delete_all_analytics(
    current_user: Annotated[CurrentUserContext, Depends(get_authenticated_admin_context)],
) -> dict:
    analytics_service.delete_all_analytics_as_admin(current_user)
    return {"status": "deleted"}
