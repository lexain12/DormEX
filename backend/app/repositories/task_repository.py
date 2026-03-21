from typing import Any

from ..core.database import get_connection
from ..core.exceptions import DomainValidationError


class TaskRepository:
    def ping(self) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")

    def list_tasks(
        self,
        *,
        limit: int,
        offset: int,
        filters: dict[str, Any],
    ) -> dict[str, Any]:
        where_clause, params = self._build_task_filters(filters)

        tasks_query = f"""
            SELECT
                t.id,
                t.customer_id,
                t.university_id,
                t.dormitory_id,
                t.title,
                t.description,
                t.category,
                t.urgency,
                t.payment_type,
                t.price_amount,
                t.barter_description,
                t.currency,
                t.visibility,
                t.status,
                t.accepted_offer_id,
                t.offers_count,
                t.published_at,
                t.starts_at,
                t.completed_at,
                t.cancelled_at,
                t.cancellation_reason,
                t.created_at,
                t.updated_at,
                u.full_name AS customer_full_name,
                u.rating_avg AS customer_rating_avg,
                uni.name AS university_name,
                d.name AS dormitory_name
            FROM tasks t
            JOIN users u ON u.id = t.customer_id
            JOIN universities uni ON uni.id = t.university_id
            JOIN dormitories d ON d.id = t.dormitory_id
            {where_clause}
            ORDER BY t.created_at DESC, t.id DESC
            LIMIT %s OFFSET %s
        """
        count_query = f"""
            SELECT COUNT(*) AS total
            FROM tasks t
            {where_clause}
        """

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(count_query, params)
                total_row = cursor.fetchone()

                cursor.execute(tasks_query, [*params, limit, offset])
                rows = list(cursor.fetchall())

        return {
            "items": [self._serialize_task_summary(row) for row in rows],
            "total": total_row["total"] if total_row is not None else 0,
            "limit": limit,
            "offset": offset,
        }

    def get_task(self, task_id: int, *, university_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        t.id,
                        t.customer_id,
                        t.university_id,
                        t.dormitory_id,
                        t.title,
                        t.description,
                        t.category,
                        t.urgency,
                        t.payment_type,
                        t.price_amount,
                        t.barter_description,
                        t.currency,
                        t.visibility,
                        t.status,
                        t.accepted_offer_id,
                        t.offers_count,
                        t.published_at,
                        t.starts_at,
                        t.completed_at,
                        t.cancelled_at,
                        t.cancellation_reason,
                        t.created_at,
                        t.updated_at,
                        u.full_name AS customer_full_name,
                        u.rating_avg AS customer_rating_avg,
                        uni.name AS university_name,
                        d.name AS dormitory_name,
                        ao.performer_id AS accepted_offer_performer_id,
                        ao.message AS accepted_offer_message,
                        ao.price_amount AS accepted_offer_price_amount,
                        ao.payment_type AS accepted_offer_payment_type,
                        ao.barter_description AS accepted_offer_barter_description,
                        ao.status AS accepted_offer_status,
                        performer.full_name AS accepted_offer_performer_full_name,
                        performer.rating_avg AS accepted_offer_performer_rating_avg
                    FROM tasks t
                    JOIN users u ON u.id = t.customer_id
                    JOIN universities uni ON uni.id = t.university_id
                    JOIN dormitories d ON d.id = t.dormitory_id
                    LEFT JOIN task_offers ao ON ao.id = t.accepted_offer_id
                    LEFT JOIN users performer ON performer.id = ao.performer_id
                    WHERE t.id = %s
                      AND t.university_id = %s
                    """,
                    (task_id, university_id),
                )
                row = cursor.fetchone()

        if row is None:
            return None

        task = self._serialize_task_summary(row)
        task["accepted_offer"] = None
        if row["accepted_offer_id"] is not None:
            task["accepted_offer"] = {
                "id": row["accepted_offer_id"],
                "performer_id": row["accepted_offer_performer_id"],
                "message": row["accepted_offer_message"],
                "price_amount": row["accepted_offer_price_amount"],
                "payment_type": row["accepted_offer_payment_type"],
                "barter_description": row["accepted_offer_barter_description"],
                "status": row["accepted_offer_status"],
                "performer": {
                    "id": row["accepted_offer_performer_id"],
                    "full_name": row["accepted_offer_performer_full_name"],
                    "rating_avg": row["accepted_offer_performer_rating_avg"],
                },
            }
        return task

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

    def create_task(self, payload: dict[str, Any]) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO tasks (
                        customer_id,
                        university_id,
                        dormitory_id,
                        title,
                        description,
                        category,
                        urgency,
                        payment_type,
                        price_amount,
                        barter_description,
                        currency,
                        visibility,
                        starts_at
                    )
                    SELECT
                        u.id,
                        u.university_id,
                        d.id,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s
                    FROM users u
                    JOIN dormitories d
                        ON d.id = %s
                       AND d.university_id = u.university_id
                    WHERE u.id = %s
                    RETURNING id
                    """,
                    (
                        payload["title"],
                        payload["description"],
                        payload["category"],
                        payload["urgency"],
                        payload["payment_type"],
                        payload.get("price_amount"),
                        payload.get("barter_description"),
                        payload.get("currency", "RUB"),
                        payload["visibility"],
                        payload.get("starts_at"),
                        payload["dormitory_id"],
                        payload["customer_id"],
                    ),
                )
                inserted = cursor.fetchone()

                if inserted is None:
                    connection.rollback()
                    raise DomainValidationError(
                        "Customer and dormitory must exist and belong to the same university"
                    )
            connection.commit()

        task = self.get_task(inserted["id"], university_id=payload["university_id"])
        if task is None:
            raise RuntimeError("Failed to load created task")
        return task

    def update_task(self, *, task_id: int, payload: dict[str, Any], university_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE tasks t
                    SET
                        dormitory_id = d.id,
                        title = %s,
                        description = %s,
                        category = %s,
                        urgency = %s,
                        payment_type = %s,
                        price_amount = %s,
                        barter_description = %s,
                        visibility = %s,
                        updated_at = CURRENT_TIMESTAMP
                    FROM dormitories d
                    WHERE t.id = %s
                      AND d.id = %s
                      AND d.university_id = %s
                    RETURNING t.id
                    """,
                    (
                        payload["title"],
                        payload["description"],
                        payload["category"],
                        payload["urgency"],
                        payload["payment_type"],
                        payload.get("price_amount"),
                        payload.get("barter_description"),
                        payload["visibility"],
                        task_id,
                        payload["dormitory_id"],
                        university_id,
                    ),
                )
                row = cursor.fetchone()
            connection.commit()

        return self.get_task(task_id, university_id=university_id) if row is not None else None

    def cancel_task(self, *, task_id: int, reason: str, university_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE tasks
                    SET
                        status = 'cancelled',
                        cancelled_at = CURRENT_TIMESTAMP,
                        cancellation_reason = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                      AND university_id = %s
                    RETURNING id
                    """,
                    (reason, task_id, university_id),
                )
                row = cursor.fetchone()
            connection.commit()
        return self.get_task(task_id, university_id=university_id) if row is not None else None

    def has_user_offer(self, *, task_id: int, performer_id: int) -> bool:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT 1
                    FROM task_offers
                    WHERE task_id = %s
                      AND performer_id = %s
                    LIMIT 1
                    """,
                    (task_id, performer_id),
                )
                return cursor.fetchone() is not None

    def get_category_analytics(self, *, university_id: int, category: str) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        COUNT(*) AS total_tasks,
                        COUNT(*) FILTER (WHERE status IN ('open', 'offers')) AS open_tasks_count,
                        COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks_count,
                        ROUND(AVG(price_amount) FILTER (WHERE payment_type = 'fixed_price'), 2) AS avg_fixed_price
                    FROM tasks
                    WHERE university_id = %s
                      AND category = %s
                    """,
                    (university_id, category),
                )
                row = cursor.fetchone()

        if row is None:
            return {
                "total_tasks": 0,
                "open_tasks_count": 0,
                "completed_tasks_count": 0,
                "avg_fixed_price": None,
            }

        return {
            "total_tasks": row["total_tasks"],
            "open_tasks_count": row["open_tasks_count"],
            "completed_tasks_count": row["completed_tasks_count"],
            "avg_fixed_price": float(row["avg_fixed_price"]) if row["avg_fixed_price"] is not None else None,
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

    def get_completion_confirmation(self, *, task_assignment_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        task_assignment_id,
                        customer_confirmed_at,
                        performer_confirmed_at,
                        status,
                        dispute_opened_by_user_id,
                        dispute_comment,
                        created_at,
                        updated_at
                    FROM task_completion_confirmations
                    WHERE task_assignment_id = %s
                    """,
                    (task_assignment_id,),
                )
                return cursor.fetchone()

    def upsert_completion_request(
        self,
        *,
        task_assignment_id: int,
        confirmer_role: str,
    ) -> dict[str, Any]:
        existing = self.get_completion_confirmation(task_assignment_id=task_assignment_id)
        column = "customer_confirmed_at" if confirmer_role == "customer" else "performer_confirmed_at"
        status = "customer_confirmed" if confirmer_role == "customer" else "performer_confirmed"

        with get_connection() as connection:
            with connection.cursor() as cursor:
                if existing is None:
                    cursor.execute(
                        f"""
                        INSERT INTO task_completion_confirmations (
                            task_assignment_id,
                            {column},
                            status
                        )
                        VALUES (%s, CURRENT_TIMESTAMP, %s)
                        RETURNING
                            id,
                            task_assignment_id,
                            customer_confirmed_at,
                            performer_confirmed_at,
                            status,
                            dispute_opened_by_user_id,
                            dispute_comment,
                            created_at,
                            updated_at
                        """,
                        (task_assignment_id, status),
                    )
                else:
                    cursor.execute(
                        f"""
                        UPDATE task_completion_confirmations
                        SET
                            {column} = CURRENT_TIMESTAMP,
                            status = %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE task_assignment_id = %s
                        RETURNING
                            id,
                            task_assignment_id,
                            customer_confirmed_at,
                            performer_confirmed_at,
                            status,
                            dispute_opened_by_user_id,
                            dispute_comment,
                            created_at,
                            updated_at
                        """,
                        (status, task_assignment_id),
                    )
                row = cursor.fetchone()
            connection.commit()
        return row

    def mark_completion_completed(self, *, task_id: int, task_assignment_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE task_completion_confirmations
                    SET
                        status = 'completed',
                        customer_confirmed_at = COALESCE(customer_confirmed_at, CURRENT_TIMESTAMP),
                        performer_confirmed_at = COALESCE(performer_confirmed_at, CURRENT_TIMESTAMP),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE task_assignment_id = %s
                    RETURNING status
                    """,
                    (task_assignment_id,),
                )
                confirmation = cursor.fetchone()

                cursor.execute(
                    """
                    UPDATE task_assignments
                    SET
                        status = 'completed',
                        completed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (task_assignment_id,),
                )

                cursor.execute(
                    """
                    UPDATE tasks
                    SET
                        status = 'completed',
                        completed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (task_id,),
                )
            connection.commit()

        return {
            "task_id": task_id,
            "confirmation_status": confirmation["status"] if confirmation is not None else "completed",
        }

    def open_dispute(
        self,
        *,
        task_assignment_id: int,
        dispute_opened_by_user_id: int,
        comment: str,
    ) -> None:
        existing = self.get_completion_confirmation(task_assignment_id=task_assignment_id)
        with get_connection() as connection:
            with connection.cursor() as cursor:
                if existing is None:
                    cursor.execute(
                        """
                        INSERT INTO task_completion_confirmations (
                            task_assignment_id,
                            status,
                            dispute_opened_by_user_id,
                            dispute_comment
                        )
                        VALUES (%s, 'disputed', %s, %s)
                        """,
                        (task_assignment_id, dispute_opened_by_user_id, comment),
                    )
                else:
                    cursor.execute(
                        """
                        UPDATE task_completion_confirmations
                        SET
                            status = 'disputed',
                            dispute_opened_by_user_id = %s,
                            dispute_comment = %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE task_assignment_id = %s
                        """,
                        (dispute_opened_by_user_id, comment, task_assignment_id),
                    )

                cursor.execute(
                    """
                    UPDATE task_assignments
                    SET status = 'disputed',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (task_assignment_id,),
                )
            connection.commit()

    def _build_task_filters(self, filters: dict[str, Any]) -> tuple[str, list[Any]]:
        conditions: list[str] = []
        params: list[Any] = []

        university_id = filters.get("university_id")
        if university_id is not None:
            conditions.append("t.university_id = %s")
            params.append(university_id)

        scope = filters.get("scope")
        dormitory_id = filters.get("dormitory_id")
        if scope == "dormitory":
            if dormitory_id is None:
                raise DomainValidationError("dormitory_id is required when scope=dormitory")
            conditions.append("t.dormitory_id = %s")
            params.append(dormitory_id)
        elif dormitory_id is not None:
            conditions.append("t.dormitory_id = %s")
            params.append(dormitory_id)

        for field_name in ("category", "status", "urgency", "payment_type"):
            value = filters.get(field_name)
            if value is not None:
                conditions.append(f"t.{field_name} = %s")
                params.append(value)

        search = filters.get("search")
        if search:
            conditions.append("(t.title ILIKE %s OR t.description ILIKE %s)")
            pattern = f"%{search}%"
            params.extend([pattern, pattern])

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        return where_clause, params

    def _serialize_task_summary(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "title": row["title"],
            "description": row["description"],
            "category": row["category"],
            "urgency": row["urgency"],
            "payment_type": row["payment_type"],
            "price_amount": row["price_amount"],
            "barter_description": row["barter_description"],
            "currency": row["currency"],
            "visibility": row["visibility"],
            "status": row["status"],
            "accepted_offer_id": row["accepted_offer_id"],
            "offers_count": row["offers_count"],
            "published_at": row["published_at"],
            "starts_at": row["starts_at"],
            "completed_at": row["completed_at"],
            "cancelled_at": row["cancelled_at"],
            "cancellation_reason": row["cancellation_reason"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "customer": {
                "id": row["customer_id"],
                "full_name": row["customer_full_name"],
                "rating_avg": row["customer_rating_avg"],
            },
            "university": {
                "id": row["university_id"],
                "name": row["university_name"],
            },
            "dormitory": {
                "id": row["dormitory_id"],
                "name": row["dormitory_name"],
            },
        }
