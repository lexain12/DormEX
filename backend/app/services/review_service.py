from datetime import datetime, timedelta, timezone

from ..core.exceptions import DomainValidationError, ForbiddenError
from ..repositories.notification_repository import NotificationRepository
from ..repositories.report_repository import ReportRepository
from ..repositories.review_repository import ReviewRepository
from ..repositories.task_repository import TaskRepository
from ..repositories.user_repository import UserRepository
from .current_user_service import CurrentUserContext


class ReviewService:
    def __init__(
        self,
        review_repository: ReviewRepository | None = None,
        task_repository: TaskRepository | None = None,
        report_repository: ReportRepository | None = None,
        notification_repository: NotificationRepository | None = None,
        user_repository: UserRepository | None = None,
    ) -> None:
        self.review_repository = review_repository or ReviewRepository()
        self.task_repository = task_repository or TaskRepository()
        self.report_repository = report_repository or ReportRepository()
        self.notification_repository = notification_repository or NotificationRepository()
        self.user_repository = user_repository or UserRepository()

    def list_task_reviews(self, task_id: int) -> list[dict]:
        return self.review_repository.list_task_reviews(task_id)

    def create_task_review(self, *, task_id: int, payload, current_user: CurrentUserContext) -> dict:
        assignment = self.task_repository.get_assignment_by_task(task_id)
        if assignment is None:
            raise DomainValidationError("Task assignment not found")
        if assignment["status"] != "completed":
            raise DomainValidationError("Task is not completed")
        if current_user.id not in (assignment["customer_id"], assignment["performer_id"]):
            raise DomainValidationError("Only task participants can leave reviews")

        target_user_id = assignment["performer_id"] if current_user.id == assignment["customer_id"] else assignment["customer_id"]
        review = self.review_repository.create_review(
            task_id=task_id,
            task_assignment_id=assignment["id"],
            author_id=current_user.id,
            target_user_id=target_user_id,
            rating=payload.rating,
            comment=payload.comment,
        )
        self.user_repository.update_user_rating_summary(target_user_id)
        self.notification_repository.create_notification(
            user_id=target_user_id,
            notification_type="review_received",
            title="Новый отзыв",
            body=f"{current_user.full_name} оставил отзыв",
            entity_type="task",
            entity_id=task_id,
            payload={"task_id": task_id, "review_id": review["id"]},
        )
        return review

    def update_review(self, *, review_id: int, payload, current_user: CurrentUserContext) -> dict:
        review = self.review_repository.get_review(review_id)
        if review is None:
            raise DomainValidationError("Review not found")
        if review["author_id"] != current_user.id:
            raise DomainValidationError("Only review author can edit review")

        created_at = review["created_at"]
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - created_at > timedelta(minutes=15):
            raise DomainValidationError("Review edit window has expired")

        updated = self.review_repository.update_review(
            review_id=review_id,
            rating=payload.rating,
            comment=payload.comment,
        )
        if updated is None:
            raise RuntimeError("Review not found after update")
        self.user_repository.update_user_rating_summary(updated["target_user_id"])
        return updated

    def report_review(self, *, review_id: int, payload, current_user: CurrentUserContext) -> dict:
        review = self.review_repository.get_review(review_id)
        if review is None:
            raise DomainValidationError("Review not found")
        return self.report_repository.create_report(
            reporter_id=current_user.id,
            target_type="review",
            target_id=review_id,
            reason_code="review_report",
            comment=payload.comment,
        )

    def list_pending_reviews(self) -> list[dict]:
        return self.review_repository.list_pending_reviews()

    def approve_review(self, *, review_id: int) -> dict:
        review = self.review_repository.set_review_moderation(
            review_id=review_id,
            moderation_status="approved",
            is_visible=True,
        )
        if review is None:
            raise DomainValidationError("Review not found")
        self.user_repository.update_user_rating_summary(review["target_user_id"])
        return review

    def hide_review(self, *, review_id: int) -> dict:
        review = self.review_repository.set_review_moderation(
            review_id=review_id,
            moderation_status="hidden",
            is_visible=False,
        )
        if review is None:
            raise DomainValidationError("Review not found")
        self.user_repository.update_user_rating_summary(review["target_user_id"])
        return review

    def delete_all_reviews_as_admin(self, current_user: CurrentUserContext) -> None:
        self._ensure_admin(current_user)
        self.review_repository.delete_all_reviews()

    def _ensure_admin(self, current_user: CurrentUserContext) -> None:
        if current_user.role != "admin":
            raise ForbiddenError("Доступно только администратору")
