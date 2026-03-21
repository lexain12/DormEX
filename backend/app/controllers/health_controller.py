from fastapi import APIRouter

from ..services.health_service import HealthService


router = APIRouter(tags=["health"])
health_service = HealthService()


@router.get("/health")
@router.get("/api/v1/health")
def healthcheck() -> dict[str, str]:
    return health_service.healthcheck()
