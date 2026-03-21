from fastapi import APIRouter, Depends, HTTPException, Query

from .dependencies import get_current_user_context
from ..schemas.user import (
    DormitoryReferenceResponse,
    MeResponse,
    MeUpdateRequest,
    PublicUserProfileResponse,
    TaskShortResponse,
    UserReviewResponse,
    UserTasksRole,
    UserTasksStatus,
)
from ..services.current_user_service import CurrentUserContext
from ..services.user_service import UserService


router = APIRouter(tags=["users"])
user_service = UserService()


@router.get("/api/v1/me", response_model=MeResponse)
def get_me(current_user: CurrentUserContext = Depends(get_current_user_context)) -> MeResponse:
    return MeResponse.model_validate(user_service.get_me(current_user))


@router.patch("/api/v1/me", response_model=MeResponse)
def patch_me(
    payload: MeUpdateRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> MeResponse:
    return MeResponse.model_validate(
        user_service.update_me(current_user=current_user, payload=payload.model_dump())
    )


@router.get("/api/v1/reference/dormitories", response_model=list[DormitoryReferenceResponse])
def list_dormitories(
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> list[DormitoryReferenceResponse]:
    return [DormitoryReferenceResponse.model_validate(item) for item in user_service.list_dormitories(current_user)]


@router.get("/api/v1/users/{user_id}", response_model=PublicUserProfileResponse)
def get_user_profile(user_id: int) -> PublicUserProfileResponse:
    profile = user_service.get_public_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    return PublicUserProfileResponse.model_validate(profile)


@router.get("/api/v1/users/{user_id}/reviews", response_model=list[UserReviewResponse])
def list_user_reviews(user_id: int) -> list[UserReviewResponse]:
    return [UserReviewResponse.model_validate(item) for item in user_service.list_user_reviews(user_id)]


@router.get("/api/v1/users/{user_id}/tasks", response_model=list[TaskShortResponse])
def list_user_tasks(
    user_id: int,
    role: UserTasksRole,
    status: UserTasksStatus | None = None,
) -> list[TaskShortResponse]:
    return [
        TaskShortResponse.model_validate(item)
        for item in user_service.list_user_tasks(user_id=user_id, role=role, status=status)
    ]


@router.get("/api/v1/me/tasks", response_model=list[TaskShortResponse])
def list_my_tasks(
    role: UserTasksRole,
    status: UserTasksStatus | None = None,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> list[TaskShortResponse]:
    return [
        TaskShortResponse.model_validate(item)
        for item in user_service.list_user_tasks(user_id=current_user.id, role=role, status=status)
    ]
