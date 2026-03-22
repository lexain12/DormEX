from ..core.exceptions import ForbiddenError
from ..repositories.analytics_repository import AnalyticsRepository
from .current_user_service import CurrentUserContext


class AnalyticsService:
    def __init__(self, analytics_repository: AnalyticsRepository | None = None) -> None:
        self.analytics_repository = analytics_repository or AnalyticsRepository()

    def get_category_analytics(self, *, category: str) -> dict:
        return self.analytics_repository.get_category_analytics(category=category)

    def delete_all_analytics_as_admin(self, current_user: CurrentUserContext) -> None:
        self._ensure_admin(current_user)
        self.analytics_repository.delete_all_analytics()

    def _ensure_admin(self, current_user: CurrentUserContext) -> None:
        if current_user.role != "admin":
            raise ForbiddenError("Доступно только администратору")
