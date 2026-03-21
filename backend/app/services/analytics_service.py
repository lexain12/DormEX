from ..repositories.analytics_repository import AnalyticsRepository


class AnalyticsService:
    def __init__(self, analytics_repository: AnalyticsRepository | None = None) -> None:
        self.analytics_repository = analytics_repository or AnalyticsRepository()

    def get_category_analytics(self, *, category: str) -> dict:
        return self.analytics_repository.get_category_analytics(category=category)
