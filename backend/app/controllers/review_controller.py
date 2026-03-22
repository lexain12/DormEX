from typing import Annotated

from fastapi import APIRouter, Depends

from .dependencies import get_authenticated_admin_context, get_current_user_context
from ..schemas.report import ReportResponse
from ..schemas.review import ReviewReportRequest, ReviewUpdateRequest, TaskReviewResponse
from ..services.current_user_service import CurrentUserContext
from ..services.review_service import ReviewService


router = APIRouter(tags=["reviews"])
review_service = ReviewService()


@router.patch("/api/v1/reviews/{review_id}", response_model=TaskReviewResponse)
def update_review(
    review_id: int,
    payload: ReviewUpdateRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> TaskReviewResponse:
    return TaskReviewResponse.model_validate(
        review_service.update_review(review_id=review_id, payload=payload, current_user=current_user)
    )


@router.post("/api/v1/reviews/{review_id}/report", response_model=ReportResponse)
def report_review(
    review_id: int,
    payload: ReviewReportRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> ReportResponse:
    return ReportResponse.model_validate(
        review_service.report_review(review_id=review_id, payload=payload, current_user=current_user)
    )


@router.delete("/admin/reviews", tags=["admin"], response_model=dict)
def delete_all_reviews(
    current_user: Annotated[CurrentUserContext, Depends(get_authenticated_admin_context)],
) -> dict:
    review_service.delete_all_reviews_as_admin(current_user)
    return {"status": "deleted"}
