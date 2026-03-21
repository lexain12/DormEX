from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from .task import DormitorySummaryResponse


class MeResponse(BaseModel):
    id: int
    email: str
    full_name: str
    avatar_url: str | None = None
    role: str
    university: dict
    dormitory: DormitorySummaryResponse | None = None
    room_label: str | None = None
    bio: str | None = None
    profile_completed: bool


class MeUpdateRequest(BaseModel):
    full_name: str
    dormitory_id: int | None = None
    room_label: str | None = None
    bio: str | None = None


class PublicUserProfileResponse(BaseModel):
    id: int
    full_name: str
    avatar_url: str | None = None
    dormitory: DormitorySummaryResponse | None = None
    rating_avg: Decimal | float | int
    reviews_count: int
    completed_tasks_count: int
    created_tasks_count: int
    badges: list[str]


class UserReviewResponse(BaseModel):
    id: int
    task_id: int
    task_assignment_id: int
    author_id: int
    author_full_name: str
    target_user_id: int
    rating: int
    comment: str | None = None
    created_at: datetime
    updated_at: datetime


UserTasksRole = Literal["customer", "performer"]
UserTasksStatus = Literal["active", "completed", "cancelled"]


class TaskShortResponse(BaseModel):
    id: int
    title: str
    category: str
    urgency: str
    payment_type: str
    price_amount: int | None = None
    status: str
    offers_count: int
    created_at: datetime


class DormitoryReferenceResponse(BaseModel):
    id: int
    name: str
    code: str | None = None
    address: str | None = None
    is_active: bool
    created_at: datetime
