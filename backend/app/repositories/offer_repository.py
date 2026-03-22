from typing import Any

from ..core.database import get_connection


class OfferRepository:
    def get_task_context(self, task_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        customer_id,
                        university_id,
                        dormitory_id,
                        title,
                        category,
                        status,
                        accepted_offer_id,
                        offers_count
                    FROM tasks
                    WHERE id = %s
                    """,
                    (task_id,),
                )
                return cursor.fetchone()

    def list_offers_for_task(self, task_id: int, performer_id: int | None = None) -> list[dict[str, Any]]:
        where_clause = "WHERE o.task_id = %s"
        params: list[Any] = [task_id]
        if performer_id is not None:
            where_clause += " AND o.performer_id = %s"
            params.append(performer_id)

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT
                        o.id,
                        o.task_id,
                        o.performer_id,
                        u.full_name AS performer_full_name,
                        u.rating_avg AS performer_rating_avg,
                        u.completed_tasks_count AS performer_completed_tasks_count,
                        o.message,
                        o.price_amount,
                        o.payment_type,
                        o.barter_description,
                        o.status,
                        o.created_at,
                        o.updated_at
                    FROM task_offers o
                    JOIN users u ON u.id = o.performer_id
                    {where_clause}
                    ORDER BY o.created_at DESC
                    """,
                    params,
                )
                return [self._serialize_offer(row) for row in cursor.fetchall()]

    def get_offer(self, offer_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        o.id,
                        o.task_id,
                        o.performer_id,
                        u.full_name AS performer_full_name,
                        u.rating_avg AS performer_rating_avg,
                        u.completed_tasks_count AS performer_completed_tasks_count,
                        o.message,
                        o.price_amount,
                        o.payment_type,
                        o.barter_description,
                        o.status,
                        o.created_at,
                        o.updated_at
                    FROM task_offers o
                    JOIN users u ON u.id = o.performer_id
                    WHERE o.id = %s
                    """,
                    (offer_id,),
                )
                row = cursor.fetchone()
                return self._serialize_offer(row) if row is not None else None

    def create_offer(self, *, task_id: int, performer_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO task_offers (
                        task_id,
                        performer_id,
                        message,
                        price_amount,
                        payment_type,
                        barter_description,
                        status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, 'pending')
                    RETURNING id
                    """,
                    (
                        task_id,
                        performer_id,
                        payload["message"],
                        payload.get("price_amount"),
                        payload["payment_type"],
                        payload.get("barter_description"),
                    ),
                )
                row = cursor.fetchone()

                cursor.execute(
                    """
                    UPDATE tasks
                    SET
                        status = CASE WHEN status = 'open' THEN 'offers' ELSE status END,
                        offers_count = (
                            SELECT COUNT(*)
                            FROM task_offers
                            WHERE task_id = %s
                              AND status IN ('pending', 'accepted')
                        ),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (task_id, task_id),
                )
            connection.commit()

        return self.get_offer(row["id"])

    def update_offer(self, *, offer_id: int, payload: dict[str, Any]) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE task_offers
                    SET
                        message = %s,
                        price_amount = %s,
                        payment_type = %s,
                        barter_description = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id
                    """,
                    (
                        payload["message"],
                        payload.get("price_amount"),
                        payload["payment_type"],
                        payload.get("barter_description"),
                        offer_id,
                    ),
                )
                row = cursor.fetchone()
            connection.commit()
        return self.get_offer(row["id"]) if row is not None else None

    def update_offer_status(self, *, offer_id: int, status: str) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE task_offers
                    SET status = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (status, offer_id),
                )
            connection.commit()

    def list_counter_offers(self, offer_id: int) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        offer_id,
                        author_user_id,
                        message,
                        payment_type,
                        price_amount,
                        barter_description,
                        status,
                        created_at,
                        updated_at
                    FROM offer_counter_offers
                    WHERE offer_id = %s
                    ORDER BY created_at ASC
                    """,
                    (offer_id,),
                )
                return list(cursor.fetchall())

    def get_counter_offer(self, counter_offer_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        offer_id,
                        author_user_id,
                        message,
                        payment_type,
                        price_amount,
                        barter_description,
                        status,
                        created_at,
                        updated_at
                    FROM offer_counter_offers
                    WHERE id = %s
                    """,
                    (counter_offer_id,),
                )
                return cursor.fetchone()

    def create_counter_offer(self, *, offer_id: int, author_user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE offer_counter_offers
                    SET status = 'superseded',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE offer_id = %s
                      AND status = 'pending'
                    """,
                    (offer_id,),
                )

                cursor.execute(
                    """
                    INSERT INTO offer_counter_offers (
                        offer_id,
                        author_user_id,
                        message,
                        price_amount,
                        payment_type,
                        barter_description,
                        status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, 'pending')
                    RETURNING
                        id,
                        offer_id,
                        author_user_id,
                        message,
                        payment_type,
                        price_amount,
                        barter_description,
                        status,
                        created_at,
                        updated_at
                    """,
                    (
                        offer_id,
                        author_user_id,
                        payload.get("message"),
                        payload.get("price_amount"),
                        payload["payment_type"],
                        payload.get("barter_description"),
                    ),
                )
                row = cursor.fetchone()
            connection.commit()
        return row

    def update_counter_offer_status(self, *, counter_offer_id: int, status: str) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE offer_counter_offers
                    SET status = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING
                        id,
                        offer_id,
                        author_user_id,
                        message,
                        payment_type,
                        price_amount,
                        barter_description,
                        status,
                        created_at,
                        updated_at
                    """,
                    (status, counter_offer_id),
                )
                row = cursor.fetchone()
            connection.commit()
        return row

    def apply_counter_offer_terms(self, *, offer_id: int, counter_offer: dict[str, Any]) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE task_offers
                    SET
                        message = COALESCE(%s, message),
                        price_amount = %s,
                        payment_type = %s,
                        barter_description = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (
                        counter_offer.get("message"),
                        counter_offer.get("price_amount"),
                        counter_offer["payment_type"],
                        counter_offer.get("barter_description"),
                        offer_id,
                    ),
                )

                cursor.execute(
                    """
                    UPDATE offer_counter_offers
                    SET status = CASE WHEN id = %s THEN status ELSE 'superseded' END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE offer_id = %s
                      AND status = 'pending'
                    """,
                    (counter_offer["id"], offer_id),
                )
            connection.commit()

    def accept_offer(
        self,
        *,
        offer_id: int,
        task_id: int,
        customer_id: int,
        performer_id: int,
        agreed_payment_type: str,
        agreed_price_amount: int | None,
        agreed_barter_description: str | None,
    ) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE task_offers
                    SET status = CASE WHEN id = %s THEN 'accepted' ELSE 'rejected' END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE task_id = %s
                      AND status IN ('pending', 'accepted')
                    """,
                    (offer_id, task_id),
                )

                cursor.execute(
                    """
                    INSERT INTO task_assignments (
                        task_id,
                        offer_id,
                        customer_id,
                        performer_id,
                        agreed_price_amount,
                        agreed_payment_type,
                        agreed_barter_description,
                        status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'in_progress')
                    RETURNING id
                    """,
                    (
                        task_id,
                        offer_id,
                        customer_id,
                        performer_id,
                        agreed_price_amount,
                        agreed_payment_type,
                        agreed_barter_description,
                    ),
                )
                assignment = cursor.fetchone()

                cursor.execute(
                    """
                    INSERT INTO task_chats (
                        task_id,
                        customer_id,
                        performer_id
                    )
                    VALUES (%s, %s, %s)
                    RETURNING id
                    """,
                    (task_id, customer_id, performer_id),
                )
                chat = cursor.fetchone()

                cursor.execute(
                    """
                    UPDATE tasks
                    SET
                        status = 'in_progress',
                        accepted_offer_id = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (offer_id, task_id),
                )
            connection.commit()

        return {
            "task_id": task_id,
            "assignment_id": assignment["id"],
            "chat_id": chat["id"],
            "status": "in_progress",
        }

    def get_assignment_by_task(self, task_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        task_id,
                        offer_id,
                        customer_id,
                        performer_id,
                        agreed_price_amount,
                        agreed_payment_type,
                        agreed_barter_description,
                        status,
                        assigned_at,
                        started_at,
                        completed_at,
                        cancelled_at,
                        created_at,
                        updated_at
                    FROM task_assignments
                    WHERE task_id = %s
                    """,
                    (task_id,),
                )
                return cursor.fetchone()

    def _serialize_offer(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "task_id": row["task_id"],
            "performer": {
                "id": row["performer_id"],
                "full_name": row["performer_full_name"],
                "rating_avg": row["performer_rating_avg"],
                "completed_tasks_count": row["performer_completed_tasks_count"],
            },
            "message": row["message"],
            "price_amount": row["price_amount"],
            "payment_type": row["payment_type"],
            "barter_description": row["barter_description"],
            "status": row["status"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def delete_all_offers(self) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM reviews")
                cursor.execute("DELETE FROM task_assignments")
                cursor.execute(
                    """
                    UPDATE tasks
                    SET
                        accepted_offer_id = NULL,
                        offers_count = 0,
                        status = CASE
                            WHEN status IN ('offers', 'in_progress') THEN 'open'
                            ELSE status
                        END,
                        updated_at = CURRENT_TIMESTAMP
                    """
                )
                cursor.execute("DELETE FROM offer_counter_offers")
                cursor.execute("DELETE FROM task_offers")
            connection.commit()
