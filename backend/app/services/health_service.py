from ..repositories.task_repository import TaskRepository


class HealthService:
    def __init__(self, task_repository: TaskRepository | None = None) -> None:
        self.task_repository = task_repository or TaskRepository()

    def healthcheck(self) -> dict[str, str]:
        self.task_repository.ping()
        return {"status": "ok"}
