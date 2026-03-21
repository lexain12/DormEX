from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator


PaymentType = Literal["fixed_price", "negotiable", "barter"]
OfferStatus = Literal["pending", "accepted", "rejected", "withdrawn"]
CounterOfferStatus = Literal["pending", "accepted", "rejected", "superseded"]


class OfferPerformerResponse(BaseModel):
    id: int
    full_name: str
    rating_avg: float | int
    completed_tasks_count: int


class OfferResponse(BaseModel):
    id: int
    task_id: int
    performer: OfferPerformerResponse
    message: str
    price_amount: int | None = None
    payment_type: PaymentType
    barter_description: str | None = None
    status: OfferStatus
    created_at: datetime
    updated_at: datetime | None = None


class OfferUpsertRequest(BaseModel):
    message: str
    price_amount: int | None = None
    payment_type: PaymentType
    barter_description: str | None = None

    @model_validator(mode="after")
    def validate_payment(self) -> "OfferUpsertRequest":
        if self.payment_type == "fixed_price":
            if self.price_amount is None or self.price_amount <= 0:
                raise ValueError("price_amount must be positive for fixed_price")
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


class CounterOfferResponse(BaseModel):
    id: int
    offer_id: int
    author_user_id: int
    message: str | None = None
    payment_type: PaymentType
    price_amount: int | None = None
    barter_description: str | None = None
    status: CounterOfferStatus
    created_at: datetime
    updated_at: datetime


class CounterOfferRequest(BaseModel):
    message: str | None = None
    payment_type: PaymentType
    price_amount: int | None = None
    barter_description: str | None = None

    @model_validator(mode="after")
    def validate_payment(self) -> "CounterOfferRequest":
        if self.payment_type == "fixed_price":
            if self.price_amount is None or self.price_amount <= 0:
                raise ValueError("price_amount must be positive for fixed_price")
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


class OfferAcceptResponse(BaseModel):
    task_id: int
    assignment_id: int
    chat_id: int
    status: str
