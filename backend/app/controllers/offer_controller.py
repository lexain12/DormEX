from fastapi import APIRouter, Depends

from .dependencies import get_authenticated_admin_context, get_current_user_context
from ..schemas.offer import (
    CounterOfferRequest,
    CounterOfferResponse,
    OfferAcceptResponse,
    OfferResponse,
    OfferUpsertRequest,
)
from ..services.current_user_service import CurrentUserContext
from ..services.offer_service import OfferService


router = APIRouter(tags=["offers"])
offer_service = OfferService()


@router.get("/api/v1/tasks/{task_id}/offers", response_model=list[OfferResponse])
def list_offers(
    task_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> list[OfferResponse]:
    return [OfferResponse.model_validate(item) for item in offer_service.list_offers(task_id=task_id, current_user=current_user)]


@router.post("/api/v1/tasks/{task_id}/offers", response_model=OfferResponse)
def create_offer(
    task_id: int,
    payload: OfferUpsertRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> OfferResponse:
    return OfferResponse.model_validate(
        offer_service.create_offer(task_id=task_id, payload=payload.model_dump(), current_user=current_user)
    )


@router.patch("/api/v1/offers/{offer_id}", response_model=OfferResponse)
def update_offer(
    offer_id: int,
    payload: OfferUpsertRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> OfferResponse:
    return OfferResponse.model_validate(
        offer_service.update_offer(offer_id=offer_id, payload=payload.model_dump(), current_user=current_user)
    )


@router.get("/api/v1/offers/{offer_id}/counter-offers", response_model=list[CounterOfferResponse])
def list_counter_offers(
    offer_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> list[CounterOfferResponse]:
    return [
        CounterOfferResponse.model_validate(item)
        for item in offer_service.list_counter_offers(offer_id=offer_id, current_user=current_user)
    ]


@router.post("/api/v1/offers/{offer_id}/counter-offers", response_model=CounterOfferResponse)
def create_counter_offer(
    offer_id: int,
    payload: CounterOfferRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> CounterOfferResponse:
    return CounterOfferResponse.model_validate(
        offer_service.create_counter_offer(offer_id=offer_id, payload=payload.model_dump(), current_user=current_user)
    )


@router.post("/api/v1/counter-offers/{counter_offer_id}/accept", response_model=OfferResponse)
def accept_counter_offer(
    counter_offer_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> OfferResponse:
    return OfferResponse.model_validate(
        offer_service.accept_counter_offer(counter_offer_id=counter_offer_id, current_user=current_user)
    )


@router.post("/api/v1/counter-offers/{counter_offer_id}/reject", response_model=CounterOfferResponse)
def reject_counter_offer(
    counter_offer_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> CounterOfferResponse:
    return CounterOfferResponse.model_validate(
        offer_service.reject_counter_offer(counter_offer_id=counter_offer_id, current_user=current_user)
    )


@router.post("/api/v1/offers/{offer_id}/withdraw", response_model=OfferResponse)
def withdraw_offer(
    offer_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> OfferResponse:
    return OfferResponse.model_validate(
        offer_service.withdraw_offer(offer_id=offer_id, current_user=current_user)
    )


@router.post("/api/v1/offers/{offer_id}/accept", response_model=OfferAcceptResponse)
def accept_offer(
    offer_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> OfferAcceptResponse:
    return OfferAcceptResponse.model_validate(
        offer_service.accept_offer(offer_id=offer_id, current_user=current_user)
    )


@router.post("/api/v1/offers/{offer_id}/reject", response_model=OfferResponse)
def reject_offer(
    offer_id: int,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> OfferResponse:
    return OfferResponse.model_validate(
        offer_service.reject_offer(offer_id=offer_id, current_user=current_user)
    )


@router.delete("/admin/offers", tags=["admin"], response_model=dict)
def delete_all_offers(
    current_user: Annotated[CurrentUserContext, Depends(get_authenticated_admin_context)],
) -> dict:
    offer_service.delete_all_offers_as_admin(current_user)
    return {"status": "deleted"}
