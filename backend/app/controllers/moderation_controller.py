from fastapi import APIRouter, Depends

from .dependencies import get_current_user_context
from ..schemas.review import TaskReviewResponse
from ..services.current_user_service import CurrentUserContext
from ..services.review_service import ReviewService


router = APIRouter(tags=["moderation"])
review_service = ReviewService()


@router.get("/api/v1/moderation/reviews", response_model=list[TaskReviewResponse])
def list_pending_reviews(
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> list[TaskReviewResponse]:
    _ = current_user
    return [TaskReviewResponse.model_validate(item) for item in review_service.list_pending_reviews()]


@router.post("/api/v1/moderation/reviews/{review_id}/approve", response_model=TaskReviewResponse)
def approve_review(
    review_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> TaskReviewResponse:
    _ = current_user
    return TaskReviewResponse.model_validate(review_service.approve_review(review_id=review_id))


@router.post("/api/v1/moderation/reviews/{review_id}/hide", response_model=TaskReviewResponse)
def hide_review(
    review_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> TaskReviewResponse:
    _ = current_user
    return TaskReviewResponse.model_validate(review_service.hide_review(review_id=review_id))
