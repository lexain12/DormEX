from fastapi import APIRouter

from ..schemas.analytics import CategoryAnalyticsFullResponse
from ..services.analytics_service import AnalyticsService


router = APIRouter(tags=["analytics"])
analytics_service = AnalyticsService()


@router.get("/api/v1/analytics/categories/{category}", response_model=CategoryAnalyticsFullResponse)
def get_category_analytics(category: str) -> CategoryAnalyticsFullResponse:
    return CategoryAnalyticsFullResponse.model_validate(
        analytics_service.get_category_analytics(category=category)
    )
