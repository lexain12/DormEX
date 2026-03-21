from datetime import datetime

from pydantic import BaseModel


class TaskReviewResponse(BaseModel):
    id: int
    task_id: int
    task_assignment_id: int
    author_id: int
    target_user_id: int
    rating: int
    comment: str | None = None
    is_visible: bool
    moderation_status: str
    created_at: datetime
    updated_at: datetime


class ReviewCreateRequest(BaseModel):
    rating: int
    comment: str | None = None


class ReviewUpdateRequest(BaseModel):
    rating: int
    comment: str | None = None


class ReviewReportRequest(BaseModel):
    comment: str | None = None
