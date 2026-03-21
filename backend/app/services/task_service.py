from ..repositories.task_repository import TaskRepository
from ..schemas.task import TaskCreateRequest


class TaskService:
    def __init__(self, task_repository: TaskRepository | None = None) -> None:
        self.task_repository = task_repository or TaskRepository()

    def list_tasks(
        self,
        *,
        scope: str | None,
        university_id: int | None,
        dormitory_id: int | None,
        category: str | None,
        status: str | None,
        urgency: str | None,
        payment_type: str | None,
        search: str | None,
        limit: int,
        offset: int,
    ) -> dict:
        return self.task_repository.list_tasks(
            limit=limit,
            offset=offset,
            filters={
                "scope": scope,
                "university_id": university_id,
                "dormitory_id": dormitory_id,
                "category": category,
                "status": status,
                "urgency": urgency,
                "payment_type": payment_type,
                "search": search,
            },
        )

    def get_task(self, task_id: int) -> dict | None:
        return self.task_repository.get_task(task_id)

    def create_task(self, payload: TaskCreateRequest) -> dict:
        return self.task_repository.create_task(payload.model_dump())
