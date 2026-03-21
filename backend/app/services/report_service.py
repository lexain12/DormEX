from ..core.exceptions import DomainValidationError
from ..repositories.notification_repository import NotificationRepository
from ..repositories.report_repository import ReportRepository
from .current_user_service import CurrentUserContext


class ReportService:
    def __init__(
        self,
        report_repository: ReportRepository | None = None,
        notification_repository: NotificationRepository | None = None,
    ) -> None:
        self.report_repository = report_repository or ReportRepository()
        self.notification_repository = notification_repository or NotificationRepository()

    def create_report(self, *, payload: dict, current_user: CurrentUserContext) -> dict:
        return self.report_repository.create_report(
            reporter_id=current_user.id,
            target_type=payload["target_type"],
            target_id=payload["target_id"],
            reason_code=payload["reason_code"],
            comment=payload.get("comment"),
        )

    def list_reports(self, *, current_user: CurrentUserContext) -> list[dict]:
        self._ensure_moderator(current_user)
        return self.report_repository.list_reports()

    def resolve_report(self, *, report_id: int, payload: dict, current_user: CurrentUserContext) -> dict:
        self._ensure_moderator(current_user)
        report = self.report_repository.resolve_report(
            report_id=report_id,
            moderator_id=current_user.id,
            resolution=payload["resolution"],
            comment=payload.get("comment"),
        )
        if report is None:
            raise DomainValidationError("Report not found")
        self.notification_repository.create_notification(
            user_id=report["reporter_id"],
            notification_type="report_resolved",
            title="Жалоба обработана",
            body="Модератор обработал вашу жалобу",
            entity_type="report",
            entity_id=report_id,
            payload={"report_id": report_id},
        )
        return report

    def _ensure_moderator(self, current_user: CurrentUserContext) -> None:
        if current_user.role not in ("moderator", "admin"):
            raise DomainValidationError("Moderator access required")
