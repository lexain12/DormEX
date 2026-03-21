from ..core.exceptions import DomainValidationError
from ..repositories.notification_repository import NotificationRepository
from ..repositories.offer_repository import OfferRepository
from ..repositories.task_repository import TaskRepository
from ..services.current_user_service import CurrentUserContext


class OfferService:
    def __init__(
        self,
        offer_repository: OfferRepository | None = None,
        task_repository: TaskRepository | None = None,
        notification_repository: NotificationRepository | None = None,
    ) -> None:
        self.offer_repository = offer_repository or OfferRepository()
        self.task_repository = task_repository or TaskRepository()
        self.notification_repository = notification_repository or NotificationRepository()

    def list_offers(self, *, task_id: int, current_user: CurrentUserContext) -> list[dict]:
        task = self.task_repository.get_task_context(task_id)
        if task is None:
            raise DomainValidationError("Task not found")

        if current_user.role in ("moderator", "admin") or task["customer_id"] == current_user.id:
            return self.offer_repository.list_offers_for_task(task_id)

        return self.offer_repository.list_offers_for_task(task_id, performer_id=current_user.id)

    def create_offer(self, *, task_id: int, payload: dict, current_user: CurrentUserContext) -> dict:
        task = self.task_repository.get_task_context(task_id)
        if task is None:
            raise DomainValidationError("Task not found")
        if task["customer_id"] == current_user.id:
            raise DomainValidationError("You cannot respond to your own task")
        if task["status"] not in ("open", "offers"):
            raise DomainValidationError("Task is not open for offers")
        if self.task_repository.has_user_offer(task_id=task_id, performer_id=current_user.id):
            raise DomainValidationError("Active offer already exists")

        offer = self.offer_repository.create_offer(task_id=task_id, performer_id=current_user.id, payload=payload)
        self.notification_repository.create_notification(
            user_id=task["customer_id"],
            notification_type="offer_received",
            title="Новый отклик на заявку",
            body=f"{current_user.full_name} предложил помочь с задачей",
            entity_type="task",
            entity_id=task_id,
            payload={"task_id": task_id, "offer_id": offer["id"]},
        )
        return offer

    def update_offer(self, *, offer_id: int, payload: dict, current_user: CurrentUserContext) -> dict:
        offer = self.offer_repository.get_offer(offer_id)
        if offer is None:
            raise DomainValidationError("Offer not found")
        if offer["performer"]["id"] != current_user.id:
            raise DomainValidationError("Only offer author can edit it")

        task = self.task_repository.get_task_context(offer["task_id"])
        if task is None or task["accepted_offer_id"] is not None:
            raise DomainValidationError("Offer can no longer be edited")
        if task["status"] not in ("open", "offers"):
            raise DomainValidationError("Offer can no longer be edited")

        updated = self.offer_repository.update_offer(offer_id=offer_id, payload=payload)
        if updated is None:
            raise DomainValidationError("Offer not found")
        return updated

    def list_counter_offers(self, *, offer_id: int, current_user: CurrentUserContext) -> list[dict]:
        offer = self.offer_repository.get_offer(offer_id)
        if offer is None:
            raise DomainValidationError("Offer not found")
        task = self.task_repository.get_task_context(offer["task_id"])
        if task is None:
            raise DomainValidationError("Task not found")
        if current_user.id not in (task["customer_id"], offer["performer"]["id"]) and current_user.role not in ("moderator", "admin"):
            raise DomainValidationError("Access denied")
        return self.offer_repository.list_counter_offers(offer_id)

    def create_counter_offer(self, *, offer_id: int, payload: dict, current_user: CurrentUserContext) -> dict:
        offer = self.offer_repository.get_offer(offer_id)
        if offer is None:
            raise DomainValidationError("Offer not found")
        task = self.task_repository.get_task_context(offer["task_id"])
        if task is None:
            raise DomainValidationError("Task not found")
        if task["accepted_offer_id"] is not None or offer["status"] == "accepted":
            raise DomainValidationError("Negotiation is closed")
        if current_user.id not in (task["customer_id"], offer["performer"]["id"]):
            raise DomainValidationError("Only task customer and offer author can send counter offer")

        created = self.offer_repository.create_counter_offer(
            offer_id=offer_id,
            author_user_id=current_user.id,
            payload=payload,
        )

        target_user_id = offer["performer"]["id"] if current_user.id == task["customer_id"] else task["customer_id"]
        self.notification_repository.create_notification(
            user_id=target_user_id,
            notification_type="counter_offer_received",
            title="Новое контрпредложение",
            body="По вашему отклику пришло новое контрпредложение",
            entity_type="offer",
            entity_id=offer_id,
            payload={"offer_id": offer_id, "counter_offer_id": created["id"]},
        )
        return created

    def accept_counter_offer(self, *, counter_offer_id: int, current_user: CurrentUserContext) -> dict:
        counter_offer = self.offer_repository.get_counter_offer(counter_offer_id)
        if counter_offer is None:
            raise DomainValidationError("Counter offer not found")
        offer = self.offer_repository.get_offer(counter_offer["offer_id"])
        if offer is None:
            raise DomainValidationError("Offer not found")
        task = self.task_repository.get_task_context(offer["task_id"])
        if task is None:
            raise DomainValidationError("Task not found")
        if current_user.id not in (task["customer_id"], offer["performer"]["id"]):
            raise DomainValidationError("Access denied")
        if counter_offer["status"] != "pending":
            raise DomainValidationError("Counter offer is no longer active")

        self.offer_repository.update_counter_offer_status(counter_offer_id=counter_offer_id, status="accepted")
        self.offer_repository.apply_counter_offer_terms(offer_id=offer["id"], counter_offer=counter_offer)

        target_user_id = offer["performer"]["id"] if current_user.id == task["customer_id"] else task["customer_id"]
        self.notification_repository.create_notification(
            user_id=target_user_id,
            notification_type="counter_offer_accepted",
            title="Контрпредложение принято",
            body="Контрпредложение принято, условия отклика обновлены",
            entity_type="offer",
            entity_id=offer["id"],
            payload={"offer_id": offer["id"], "counter_offer_id": counter_offer_id},
        )
        updated_offer = self.offer_repository.get_offer(offer["id"])
        if updated_offer is None:
            raise RuntimeError("Updated offer not found")
        return updated_offer

    def reject_counter_offer(self, *, counter_offer_id: int, current_user: CurrentUserContext) -> dict:
        counter_offer = self.offer_repository.get_counter_offer(counter_offer_id)
        if counter_offer is None:
            raise DomainValidationError("Counter offer not found")
        offer = self.offer_repository.get_offer(counter_offer["offer_id"])
        if offer is None:
            raise DomainValidationError("Offer not found")
        task = self.task_repository.get_task_context(offer["task_id"])
        if task is None:
            raise DomainValidationError("Task not found")
        if current_user.id not in (task["customer_id"], offer["performer"]["id"]):
            raise DomainValidationError("Access denied")
        if counter_offer["status"] != "pending":
            raise DomainValidationError("Counter offer is no longer active")

        updated = self.offer_repository.update_counter_offer_status(counter_offer_id=counter_offer_id, status="rejected")
        target_user_id = offer["performer"]["id"] if current_user.id == task["customer_id"] else task["customer_id"]
        self.notification_repository.create_notification(
            user_id=target_user_id,
            notification_type="counter_offer_rejected",
            title="Контрпредложение отклонено",
            body="Контрпредложение было отклонено",
            entity_type="offer",
            entity_id=offer["id"],
            payload={"offer_id": offer["id"], "counter_offer_id": counter_offer_id},
        )
        if updated is None:
            raise RuntimeError("Counter offer not found after update")
        return updated

    def withdraw_offer(self, *, offer_id: int, current_user: CurrentUserContext) -> dict:
        offer = self.offer_repository.get_offer(offer_id)
        if offer is None:
            raise DomainValidationError("Offer not found")
        if offer["performer"]["id"] != current_user.id:
            raise DomainValidationError("Only offer author can withdraw offer")

        self.offer_repository.update_offer_status(offer_id=offer_id, status="withdrawn")
        updated = self.offer_repository.get_offer(offer_id)
        if updated is None:
            raise RuntimeError("Offer not found after update")
        return updated

    def accept_offer(self, *, offer_id: int, current_user: CurrentUserContext) -> dict:
        offer = self.offer_repository.get_offer(offer_id)
        if offer is None:
            raise DomainValidationError("Offer not found")
        task = self.task_repository.get_task_context(offer["task_id"])
        if task is None:
            raise DomainValidationError("Task not found")
        if task["customer_id"] != current_user.id:
            raise DomainValidationError("Only task author can accept offer")
        if task["status"] not in ("open", "offers"):
            raise DomainValidationError("Task is not open for accepting offers")
        if task["accepted_offer_id"] is not None:
            raise DomainValidationError("Task already has accepted offer")

        result = self.offer_repository.accept_offer(
            offer_id=offer_id,
            task_id=task["id"],
            customer_id=task["customer_id"],
            performer_id=offer["performer"]["id"],
            agreed_payment_type=offer["payment_type"],
            agreed_price_amount=offer["price_amount"],
            agreed_barter_description=offer["barter_description"],
        )
        self.notification_repository.create_notification(
            user_id=offer["performer"]["id"],
            notification_type="offer_accepted",
            title="Ваш отклик принят",
            body="Заказчик выбрал вас исполнителем",
            entity_type="task",
            entity_id=task["id"],
            payload={"task_id": task["id"], "offer_id": offer_id, "chat_id": result["chat_id"]},
        )
        return result

    def reject_offer(self, *, offer_id: int, current_user: CurrentUserContext) -> dict:
        offer = self.offer_repository.get_offer(offer_id)
        if offer is None:
            raise DomainValidationError("Offer not found")
        task = self.task_repository.get_task_context(offer["task_id"])
        if task is None:
            raise DomainValidationError("Task not found")
        if task["customer_id"] != current_user.id:
            raise DomainValidationError("Only task author can reject offer")

        self.offer_repository.update_offer_status(offer_id=offer_id, status="rejected")
        self.notification_repository.create_notification(
            user_id=offer["performer"]["id"],
            notification_type="offer_rejected",
            title="Ваш отклик отклонён",
            body="Заказчик отклонил ваш отклик",
            entity_type="task",
            entity_id=task["id"],
            payload={"task_id": task["id"], "offer_id": offer_id},
        )
        updated = self.offer_repository.get_offer(offer_id)
        if updated is None:
            raise RuntimeError("Offer not found after update")
        return updated
