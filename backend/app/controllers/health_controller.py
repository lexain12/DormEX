from fastapi import APIRouter, Depends

from .dependencies import get_authenticated_user_context
from ..services.health_service import HealthService
from ..services.current_user_service import CurrentUserContext


router = APIRouter(tags=["health"])
health_service = HealthService()


@router.get("/health", include_in_schema=False)
@router.get("/api/v1/health")
def healthcheck(_: CurrentUserContext = Depends(get_authenticated_user_context)) -> dict[str, str]:
    return health_service.healthcheck()
