import json
from typing import Any

from ..core.database import get_connection


class NotificationRepository:
    def create_notification(
        self,
        *,
        user_id: int,
        notification_type: str,
        title: str,
        body: str,
        entity_type: str | None = None,
        entity_id: int | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO notifications (
                        user_id,
                        type,
                        title,
                        body,
                        entity_type,
                        entity_id,
                        payload
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
                    """,
                    (
                        user_id,
                        notification_type,
                        title,
                        body,
                        entity_type,
                        entity_id,
                        json.dumps(payload) if payload is not None else None,
                    ),
                )
            connection.commit()

    def list_notifications(self, *, user_id: int, status: str, limit: int, offset: int) -> dict[str, Any]:
        where_clause = "WHERE user_id = %s"
        params: list[Any] = [user_id]

        if status == "unread":
            where_clause += " AND is_read = FALSE"

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT
                        id,
                        type,
                        title,
                        body,
                        entity_type,
                        entity_id,
                        payload,
                        is_read,
                        created_at
                    FROM notifications
                    {where_clause}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    [*params, limit, offset],
                )
                items = list(cursor.fetchall())

                cursor.execute(
                    """
                    SELECT COUNT(*) AS unread_count
                    FROM notifications
                    WHERE user_id = %s
                      AND is_read = FALSE
                    """,
                    (user_id,),
                )
                unread = cursor.fetchone()

        return {
            "items": [self._serialize_notification(item) for item in items],
            "unread_count": unread["unread_count"] if unread is not None else 0,
            "limit": limit,
            "offset": offset,
        }

    def get_unread_count(self, *, user_id: int) -> int:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT COUNT(*) AS unread_count
                    FROM notifications
                    WHERE user_id = %s
                      AND is_read = FALSE
                    """,
                    (user_id,),
                )
                row = cursor.fetchone()
                return row["unread_count"] if row is not None else 0

    def mark_read(self, *, user_id: int, notification_id: int) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE notifications
                    SET is_read = TRUE,
                        read_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                      AND user_id = %s
                    """,
                    (notification_id, user_id),
                )
            connection.commit()

    def mark_all_read(self, *, user_id: int) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE notifications
                    SET is_read = TRUE,
                        read_at = CURRENT_TIMESTAMP
                    WHERE user_id = %s
                      AND is_read = FALSE
                    """,
                    (user_id,),
                )
            connection.commit()

    def get_preferences(self, *, user_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        in_app_enabled,
                        web_push_enabled,
                        offers_enabled,
                        counter_offers_enabled,
                        chat_enabled,
                        task_updates_enabled,
                        reviews_enabled,
                        moderation_enabled
                    FROM notification_preferences
                    WHERE user_id = %s
                    """,
                    (user_id,),
                )
                row = cursor.fetchone()

            if row is None:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO notification_preferences (user_id)
                        VALUES (%s)
                        RETURNING
                            in_app_enabled,
                            web_push_enabled,
                            offers_enabled,
                            counter_offers_enabled,
                            chat_enabled,
                            task_updates_enabled,
                            reviews_enabled,
                            moderation_enabled
                        """,
                        (user_id,),
                    )
                    row = cursor.fetchone()
                connection.commit()

        return row

    def update_preferences(self, *, user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        self.get_preferences(user_id=user_id)
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE notification_preferences
                    SET
                        in_app_enabled = %s,
                        web_push_enabled = %s,
                        offers_enabled = %s,
                        counter_offers_enabled = %s,
                        chat_enabled = %s,
                        task_updates_enabled = %s,
                        reviews_enabled = %s,
                        moderation_enabled = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = %s
                    RETURNING
                        in_app_enabled,
                        web_push_enabled,
                        offers_enabled,
                        counter_offers_enabled,
                        chat_enabled,
                        task_updates_enabled,
                        reviews_enabled,
                        moderation_enabled
                    """,
                    (
                        payload["in_app_enabled"],
                        payload["web_push_enabled"],
                        payload["offers_enabled"],
                        payload["counter_offers_enabled"],
                        payload["chat_enabled"],
                        payload["task_updates_enabled"],
                        payload["reviews_enabled"],
                        payload["moderation_enabled"],
                        user_id,
                    ),
                )
                row = cursor.fetchone()
            connection.commit()
        return row

    def save_web_push_subscription(
        self,
        *,
        user_id: int,
        endpoint: str,
        p256dh_key: str,
        auth_key: str,
        user_agent: str | None,
    ) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO web_push_subscriptions (
                        user_id,
                        endpoint,
                        p256dh_key,
                        auth_key,
                        user_agent
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (user_id, endpoint)
                    DO UPDATE SET
                        p256dh_key = EXCLUDED.p256dh_key,
                        auth_key = EXCLUDED.auth_key,
                        user_agent = EXCLUDED.user_agent,
                        is_active = TRUE,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING id
                    """,
                    (user_id, endpoint, p256dh_key, auth_key, user_agent),
                )
                row = cursor.fetchone()
            connection.commit()
        return row

    def delete_web_push_subscription(self, *, user_id: int, subscription_id: int) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM web_push_subscriptions
                    WHERE id = %s
                      AND user_id = %s
                    """,
                    (subscription_id, user_id),
                )
            connection.commit()

    def list_latest_notifications(self, *, user_id: int, after_id: int | None = None) -> list[dict[str, Any]]:
        where_clause = "WHERE user_id = %s"
        params: list[Any] = [user_id]
        if after_id is not None:
            where_clause += " AND id > %s"
            params.append(after_id)

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT
                        id,
                        type,
                        title,
                        body,
                        entity_type,
                        entity_id,
                        payload,
                        is_read,
                        created_at
                    FROM notifications
                    {where_clause}
                    ORDER BY id ASC
                    LIMIT 20
                    """,
                    params,
                )
                return [self._serialize_notification(item) for item in cursor.fetchall()]

    def _serialize_notification(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "type": row["type"],
            "title": row["title"],
            "body": row["body"],
            "entity_type": row["entity_type"],
            "entity_id": row["entity_id"],
            "payload": row["payload"],
            "is_read": row["is_read"],
            "created_at": row["created_at"],
        }

    def delete_all_notifications(self) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM web_push_subscriptions")
                cursor.execute("DELETE FROM notifications")
            connection.commit()
