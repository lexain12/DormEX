import os
import re
from typing import Literal

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, Field, field_validator, model_validator


TaskCategory = Literal["cleaning", "moving", "delivery", "tech_help", "study_help", "other"]
TaskUrgency = Literal["urgent", "today", "this_week", "flexible"]
TaskPaymentType = Literal["fixed_price", "negotiable", "barter"]
TaskVisibility = Literal["dormitory", "university"]
LOCAL_AUTH_EMAIL_DOMAIN = os.getenv("LOCAL_AUTH_EMAIL_DOMAIN", "campus.test").lower()
SIMPLE_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EmailPayloadMixin(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, value: str) -> str:
        normalized_value = value.strip().lower()
        try:
            return validate_email(normalized_value, check_deliverability=False).normalized
        except EmailNotValidError:
            if normalized_value.endswith(f"@{LOCAL_AUTH_EMAIL_DOMAIN}") and SIMPLE_EMAIL_RE.match(normalized_value):
                return normalized_value
            raise ValueError("Введите корректный email")


class EmailCodeRequest(EmailPayloadMixin):
    pass


class EmailCodeVerifyRequest(EmailPayloadMixin):
    code: str

    @field_validator("code")
    @classmethod
    def validate_code_field(cls, value: str) -> str:
        normalized_value = value.strip()
        if not re.fullmatch(r"\d{6}", normalized_value):
            raise ValueError("Введите 6-значный код")
        return normalized_value


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
