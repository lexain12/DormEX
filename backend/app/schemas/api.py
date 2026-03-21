from typing import Literal

from pydantic import BaseModel, Field, model_validator


TaskCategory = Literal["cleaning", "moving", "delivery", "tech_help", "study_help", "other"]
TaskUrgency = Literal["urgent", "today", "this_week", "flexible"]
TaskPaymentType = Literal["fixed_price", "negotiable", "barter"]
TaskVisibility = Literal["dormitory", "university"]


class EmailCodeRequest(BaseModel):
    email: str


class EmailCodeVerifyRequest(BaseModel):
    email: str
    code: str = Field(min_length=4, max_length=12)


class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = None


class UpdateMeRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    dormitory_id: int
    room_label: str | None = Field(default=None, max_length=50)
    bio: str | None = Field(default=None, max_length=1000)


class PaymentTermsMixin(BaseModel):
    payment_type: TaskPaymentType
    price_amount: int | None = None
    barter_description: str | None = None

    @model_validator(mode="after")
    def validate_payment_terms(self) -> "PaymentTermsMixin":
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


class CreateTaskRequest(PaymentTermsMixin):
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=3, max_length=5000)
    category: TaskCategory
    urgency: TaskUrgency
    visibility: TaskVisibility = "university"
    dormitory_id: int


class CreateOfferRequest(PaymentTermsMixin):
    message: str = Field(min_length=2, max_length=5000)


class UpdateOfferRequest(PaymentTermsMixin):
    message: str = Field(min_length=2, max_length=5000)


class CreateCounterOfferRequest(PaymentTermsMixin):
    message: str | None = Field(default=None, max_length=5000)


class CancelTaskRequest(BaseModel):
    reason: str = Field(min_length=2, max_length=2000)


class OpenDisputeRequest(BaseModel):
    comment: str = Field(min_length=2, max_length=2000)


class ChatMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
