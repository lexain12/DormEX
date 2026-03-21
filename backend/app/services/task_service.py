from ..core.exceptions import DomainValidationError
from ..repositories.notification_repository import NotificationRepository
from ..repositories.task_repository import TaskRepository
from ..repositories.user_repository import UserRepository
from ..schemas.task import TaskCreateRequest, TaskUpdateRequest
from .current_user_service import CurrentUserContext


class TaskService:
    def __init__(
        self,
        task_repository: TaskRepository | None = None,
        notification_repository: NotificationRepository | None = None,
        user_repository: UserRepository | None = None,
    ) -> None:
        self.task_repository = task_repository or TaskRepository()
        self.notification_repository = notification_repository or NotificationRepository()
        self.user_repository = user_repository or UserRepository()

    def list_tasks(
        self,
        *,
        current_user: CurrentUserContext,
        scope: str | None,
        dormitory_id: int | None,
        category: str | None,
        status: str | None,
        urgency: str | None,
        payment_type: str | None,
        search: str | None,
        limit: int,
        offset: int,
    ) -> dict:
        effective_dormitory_id = dormitory_id
        if scope == "dormitory" and effective_dormitory_id is None:
            if current_user.dormitory_id is None:
                raise DomainValidationError("Current user does not have a dormitory selected")
            effective_dormitory_id = current_user.dormitory_id

        return self.task_repository.list_tasks(
            limit=limit,
            offset=offset,
            filters={
                "scope": scope,
                "university_id": current_user.university_id,
                "dormitory_id": effective_dormitory_id,
                "category": category,
                "status": status,
                "urgency": urgency,
                "payment_type": payment_type,
                "search": search,
            },
        )

    def get_task(self, task_id: int, *, current_user: CurrentUserContext) -> dict | None:
        task = self.task_repository.get_task(task_id, university_id=current_user.university_id)
        if task is None:
            return None

        has_existing_offer = self.task_repository.has_user_offer(task_id=task_id, performer_id=current_user.id)
        task["author"] = task["customer"]
        task["can_apply"] = (
            current_user.id != task["customer"]["id"]
            and task["status"] in ("open", "offers")
            and task["accepted_offer"] is None
            and not has_existing_offer
        )
        task["can_choose_performer"] = (
            current_user.id == task["customer"]["id"]
            and task["status"] in ("open", "offers")
        )
        task["category_analytics"] = self.task_repository.get_category_analytics(
            university_id=current_user.university_id,
            category=task["category"],
        )
        return task

    def create_task(self, payload: TaskCreateRequest, *, current_user: CurrentUserContext) -> dict:
        task = self.task_repository.create_task(
            {
                **payload.model_dump(),
                "customer_id": current_user.id,
                "university_id": current_user.university_id,
            }
        )
        self.user_repository.increment_created_tasks_count(current_user.id)
        task["author"] = task["customer"]
        task["can_apply"] = False
        task["can_choose_performer"] = True
        task["category_analytics"] = self.task_repository.get_category_analytics(
            university_id=current_user.university_id,
            category=task["category"],
        )
        return task

    def update_task(
        self,
        *,
        task_id: int,
        payload: TaskUpdateRequest,
        current_user: CurrentUserContext,
    ) -> dict:
        task_context = self.task_repository.get_task_context(task_id)
        if task_context is None:
            raise DomainValidationError("Task not found")
        if task_context["customer_id"] != current_user.id:
            raise DomainValidationError("Only task author can edit task")
        if task_context["status"] in ("in_progress", "completed", "cancelled"):
            raise DomainValidationError("Task cannot be edited in current status")

        task = self.task_repository.update_task(
            task_id=task_id,
            payload=payload.model_dump(),
            university_id=current_user.university_id,
        )
        if task is None:
            raise DomainValidationError("Dormitory must belong to the current user university")

        task["author"] = task["customer"]
        task["can_apply"] = False
        task["can_choose_performer"] = True
        task["category_analytics"] = self.task_repository.get_category_analytics(
            university_id=current_user.university_id,
            category=task["category"],
        )
        return task

    def cancel_task(self, *, task_id: int, reason: str, current_user: CurrentUserContext) -> dict:
        task_context = self.task_repository.get_task_context(task_id)
        if task_context is None:
            raise DomainValidationError("Task not found")
        if task_context["customer_id"] != current_user.id:
            raise DomainValidationError("Only task author can cancel task")
        if task_context["status"] in ("completed", "cancelled"):
            raise DomainValidationError("Task is already finished")

        task = self.task_repository.cancel_task(
            task_id=task_id,
            reason=reason,
            university_id=current_user.university_id,
        )
        if task is None:
            raise DomainValidationError("Task not found")

        task["author"] = task["customer"]
        task["can_apply"] = False
        task["can_choose_performer"] = False
        task["category_analytics"] = self.task_repository.get_category_analytics(
            university_id=current_user.university_id,
            category=task["category"],
        )
        return task

    def complete_request(self, *, task_id: int, current_user: CurrentUserContext) -> dict:
        assignment = self.task_repository.get_assignment_by_task(task_id)
        if assignment is None:
            raise DomainValidationError("Task assignment not found")
        if assignment["status"] != "in_progress":
            raise DomainValidationError("Task is not in progress")

        confirmer_role = self._resolve_assignment_role(assignment, current_user.id)
        confirmation = self.task_repository.upsert_completion_request(
            task_assignment_id=assignment["id"],
            confirmer_role=confirmer_role,
        )
        return {
            "task_id": task_id,
            "confirmation_status": confirmation["status"],
        }

    def confirm_completion(self, *, task_id: int, current_user: CurrentUserContext) -> dict:
        assignment = self.task_repository.get_assignment_by_task(task_id)
        if assignment is None:
            raise DomainValidationError("Task assignment not found")
        if assignment["status"] not in ("in_progress", "disputed"):
            raise DomainValidationError("Task is not ready for completion confirmation")

        confirmer_role = self._resolve_assignment_role(assignment, current_user.id)
        self.task_repository.upsert_completion_request(
            task_assignment_id=assignment["id"],
            confirmer_role=confirmer_role,
        )
        result = self.task_repository.mark_completion_completed(task_id=task_id, task_assignment_id=assignment["id"])
        self.user_repository.increment_completed_tasks_count([assignment["customer_id"], assignment["performer_id"]])
        return result

    def open_dispute(self, *, task_id: int, comment: str, current_user: CurrentUserContext) -> dict:
        assignment = self.task_repository.get_assignment_by_task(task_id)
        if assignment is None:
            raise DomainValidationError("Task assignment not found")
        self._resolve_assignment_role(assignment, current_user.id)

        self.task_repository.open_dispute(
            task_assignment_id=assignment["id"],
            dispute_opened_by_user_id=current_user.id,
            comment=comment,
        )
        return {
            "task_id": task_id,
            "confirmation_status": "disputed",
        }

    def _resolve_assignment_role(self, assignment: dict, user_id: int) -> str:
        if assignment["customer_id"] == user_id:
            return "customer"
        if assignment["performer_id"] == user_id:
            return "performer"
        raise DomainValidationError("Current user is not a participant of this task")
