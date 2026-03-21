from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, model_validator


TaskCategory = Literal["cleaning", "moving", "delivery", "tech_help", "study_help", "other"]
TaskUrgency = Literal["urgent", "today", "this_week", "flexible"]
TaskPaymentType = Literal["fixed_price", "negotiable", "barter"]
TaskVisibility = Literal["dormitory", "university"]
TaskStatus = Literal["open", "offers", "in_progress", "completed", "cancelled"]
TaskScope = Literal["university", "dormitory"]


class TaskCreateRequest(BaseModel):
    customer_id: int
    dormitory_id: int
    title: str
    description: str
    category: TaskCategory
    urgency: TaskUrgency
    payment_type: TaskPaymentType
    price_amount: int | None = None
    barter_description: str | None = None
    visibility: TaskVisibility = "university"
    currency: str = "RUB"
    starts_at: datetime | None = None

    @model_validator(mode="after")
    def validate_payment(self) -> "TaskCreateRequest":
        if self.payment_type == "fixed_price":
            if self.price_amount is None or self.price_amount <= 0:
                raise ValueError("price_amount must be a positive integer for fixed_price")
            if self.barter_description is not None:
                raise ValueError("barter_description must be null for fixed_price")

        if self.payment_type == "negotiable":
            if self.price_amount is not None or self.barter_description is not None:
                raise ValueError("price_amount and barter_description must be null for negotiable")

        if self.payment_type == "barter":
            if self.price_amount is not None:
                raise ValueError("price_amount must be null for barter")
            if not self.barter_description:
                raise ValueError("barter_description is required for barter")

        return self


class UserSummaryResponse(BaseModel):
    id: int
    full_name: str
    rating_avg: Decimal | float | int


class UniversitySummaryResponse(BaseModel):
    id: int
    name: str


class DormitorySummaryResponse(BaseModel):
    id: int
    name: str


class AcceptedOfferPerformerResponse(BaseModel):
    id: int
    full_name: str


class AcceptedOfferResponse(BaseModel):
    id: int
    performer_id: int
    message: str
    price_amount: int | None = None
    payment_type: TaskPaymentType
    barter_description: str | None = None
    status: str
    performer: AcceptedOfferPerformerResponse


class TaskSummaryResponse(BaseModel):
    id: int
    customer_id: int
    university_id: int
    dormitory_id: int
    title: str
    description: str
    category: TaskCategory
    urgency: TaskUrgency
    payment_type: TaskPaymentType
    price_amount: int | None = None
    barter_description: str | None = None
    currency: str
    visibility: TaskVisibility
    status: TaskStatus
    accepted_offer_id: int | None = None
    offers_count: int
    published_at: datetime
    starts_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    customer: UserSummaryResponse
    university: UniversitySummaryResponse
    dormitory: DormitorySummaryResponse


class TaskDetailResponse(TaskSummaryResponse):
    accepted_offer: AcceptedOfferResponse | None = None


class TaskListResponse(BaseModel):
    items: list[TaskSummaryResponse]
    total: int
    limit: int
    offset: int
