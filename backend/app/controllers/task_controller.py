from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from .dependencies import get_current_user_context
from ..schemas.review import ReviewCreateRequest, ReviewUpdateRequest, TaskReviewResponse
from ..schemas.task import (
    TaskCancelRequest,
    TaskCategory,
    TaskCompletionResponse,
    TaskCreateRequest,
    TaskDetailResponse,
    TaskDisputeRequest,
    TaskListResponse,
    TaskPaymentType,
    TaskScope,
    TaskStatus,
    TaskUpdateRequest,
    TaskUrgency,
)
from ..services.current_user_service import CurrentUserContext
from ..services.review_service import ReviewService
from ..services.task_service import TaskService


router = APIRouter(tags=["tasks"])
task_service = TaskService()
review_service = ReviewService()

task_create_body = Body(
    ...,
    openapi_examples={
        "fixed_price": {
            "summary": "Fixed price task",
            "value": {
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
        }
    },
)


@router.get("/tasks", response_model=TaskListResponse)
@router.get("/api/v1/tasks", response_model=TaskListResponse)
def list_tasks(
    scope: TaskScope | None = None,
    dormitory_id: int | None = None,
    category: TaskCategory | None = None,
    status: TaskStatus | None = None,
    urgency: TaskUrgency | None = None,
    payment_type: TaskPaymentType | None = None,
    search: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> TaskListResponse:
    result = task_service.list_tasks(
        current_user=current_user,
        scope=scope,
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


@router.get("/tasks/{task_id}", response_model=TaskDetailResponse)
@router.get("/api/v1/tasks/{task_id}", response_model=TaskDetailResponse)
def get_task(
    task_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> TaskDetailResponse:
    task = task_service.get_task(task_id, current_user=current_user)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskDetailResponse.model_validate(task)


@router.post("/tasks", status_code=201, response_model=TaskDetailResponse)
@router.post("/api/v1/tasks", status_code=201, response_model=TaskDetailResponse)
def create_task(
    payload: Annotated[TaskCreateRequest, task_create_body],
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> TaskDetailResponse:
    task = task_service.create_task(payload, current_user=current_user)
    return TaskDetailResponse.model_validate(task)


@router.patch("/api/v1/tasks/{task_id}", response_model=TaskDetailResponse)
def update_task(
    task_id: int,
    payload: TaskUpdateRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> TaskDetailResponse:
    return TaskDetailResponse.model_validate(
        task_service.update_task(task_id=task_id, payload=payload, current_user=current_user)
    )


@router.post("/api/v1/tasks/{task_id}/cancel", response_model=TaskDetailResponse)
def cancel_task(
    task_id: int,
    payload: TaskCancelRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> TaskDetailResponse:
    return TaskDetailResponse.model_validate(
        task_service.cancel_task(task_id=task_id, reason=payload.reason, current_user=current_user)
    )


@router.post("/api/v1/tasks/{task_id}/complete-request", response_model=TaskCompletionResponse)
def complete_request(
    task_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> TaskCompletionResponse:
    return TaskCompletionResponse.model_validate(
        task_service.complete_request(task_id=task_id, current_user=current_user)
    )


@router.post("/api/v1/tasks/{task_id}/confirm-completion", response_model=TaskCompletionResponse)
def confirm_completion(
    task_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> TaskCompletionResponse:
    return TaskCompletionResponse.model_validate(
        task_service.confirm_completion(task_id=task_id, current_user=current_user)
    )


@router.post("/api/v1/tasks/{task_id}/open-dispute", response_model=TaskCompletionResponse)
def open_dispute(
    task_id: int,
    payload: TaskDisputeRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> TaskCompletionResponse:
    return TaskCompletionResponse.model_validate(
        task_service.open_dispute(task_id=task_id, comment=payload.comment, current_user=current_user)
    )


@router.get("/api/v1/tasks/{task_id}/reviews", response_model=list[TaskReviewResponse])
def list_task_reviews(task_id: int) -> list[TaskReviewResponse]:
    return [TaskReviewResponse.model_validate(item) for item in review_service.list_task_reviews(task_id)]


@router.post("/api/v1/tasks/{task_id}/reviews", response_model=TaskReviewResponse)
def create_task_review(
    task_id: int,
    payload: ReviewCreateRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> TaskReviewResponse:
    return TaskReviewResponse.model_validate(
        review_service.create_task_review(task_id=task_id, payload=payload, current_user=current_user)
    )
