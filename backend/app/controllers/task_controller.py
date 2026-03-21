from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Query

from ..core.exceptions import DomainValidationError
from ..schemas.task import (
    TaskCategory,
    TaskCreateRequest,
    TaskDetailResponse,
    TaskListResponse,
    TaskPaymentType,
    TaskScope,
    TaskStatus,
    TaskUrgency,
)
from ..services.task_service import TaskService


router = APIRouter(tags=["tasks"])
task_service = TaskService()

task_create_body = Body(
    ...,
    openapi_examples={
        "fixed_price": {
            "summary": "Fixed price task",
            "value": {
                "customer_id": 1,
                "dormitory_id": 7,
                "title": "Помочь перенести мебель с 3 на 7 этаж",
                "description": "Нужна помощь с переносом стола и двух стульев",
                "category": "moving",
                "urgency": "urgent",
                "payment_type": "fixed_price",
                "price_amount": 800,
                "barter_description": None,
                "visibility": "university",
                "currency": "RUB",
                "starts_at": None,
            },
        },
        "barter": {
            "summary": "Barter task",
            "value": {
                "customer_id": 1,
                "dormitory_id": 7,
                "title": "Нужна помощь с настройкой ноутбука",
                "description": "Плохо работает Wi-Fi, нужен опытный студент",
                "category": "tech_help",
                "urgency": "today",
                "payment_type": "barter",
                "price_amount": None,
                "barter_description": "Взамен помогу с английским",
                "visibility": "dormitory",
                "currency": "RUB",
                "starts_at": None,
            },
        },
    },
)


@router.get("/tasks", response_model=TaskListResponse)
@router.get("/api/v1/tasks", response_model=TaskListResponse)
def list_tasks(
    scope: TaskScope | None = None,
    university_id: int | None = None,
    dormitory_id: int | None = None,
    category: TaskCategory | None = None,
    status: TaskStatus | None = None,
    urgency: TaskUrgency | None = None,
    payment_type: TaskPaymentType | None = None,
    search: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> TaskListResponse:
    try:
        result = task_service.list_tasks(
            scope=scope,
            university_id=university_id,
            dormitory_id=dormitory_id,
            category=category,
            status=status,
            urgency=urgency,
            payment_type=payment_type,
            search=search,
            limit=limit,
            offset=offset,
        )
        return TaskListResponse.model_validate(result)
    except DomainValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/tasks/{task_id}", response_model=TaskDetailResponse)
@router.get("/api/v1/tasks/{task_id}", response_model=TaskDetailResponse)
def get_task(task_id: int) -> TaskDetailResponse:
    task = task_service.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskDetailResponse.model_validate(task)


@router.post("/tasks", status_code=201, response_model=TaskDetailResponse)
@router.post("/api/v1/tasks", status_code=201, response_model=TaskDetailResponse)
def create_task(
    payload: Annotated[TaskCreateRequest, task_create_body],
) -> TaskDetailResponse:
    try:
        task = task_service.create_task(payload)
        return TaskDetailResponse.model_validate(task)
    except DomainValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
