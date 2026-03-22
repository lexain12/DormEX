from typing import Any

from ..core.database import get_connection


class ChatRepository:
    def list_chats(self, *, user_id: int) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        c.id,
                        c.task_id,
                        c.customer_id,
                        cu.full_name AS customer_full_name,
                        c.performer_id,
                        pu.full_name AS performer_full_name,
                        c.created_at,
                        c.updated_at
                    FROM task_chats c
                    JOIN users cu ON cu.id = c.customer_id
                    JOIN users pu ON pu.id = c.performer_id
                    WHERE c.customer_id = %s
                       OR c.performer_id = %s
                    ORDER BY c.updated_at DESC
                    """,
                    (user_id, user_id),
                )
                return [self._serialize_chat(row) for row in cursor.fetchall()]

    def get_chat(self, chat_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        c.id,
                        c.task_id,
                        c.customer_id,
                        cu.full_name AS customer_full_name,
                        c.performer_id,
                        pu.full_name AS performer_full_name,
                        c.created_at,
                        c.updated_at
                    FROM task_chats c
                    JOIN users cu ON cu.id = c.customer_id
                    JOIN users pu ON pu.id = c.performer_id
                    WHERE c.id = %s
                    """,
                    (chat_id,),
                )
                row = cursor.fetchone()
                return self._serialize_chat(row) if row is not None else None

    def list_messages(
        self,
        *,
        chat_id: int,
        limit: int,
        before_message_id: int | None,
    ) -> list[dict[str, Any]]:
        where_clause = "WHERE chat_id = %s"
        params: list[Any] = [chat_id]
        if before_message_id is not None:
            where_clause += " AND id < %s"
            params.append(before_message_id)

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT
                        id,
                        chat_id,
                        sender_id,
                        message_type,
                        body,
                        created_at,
                        read_at
                    FROM chat_messages
                    {where_clause}
                    ORDER BY id DESC
                    LIMIT %s
                    """,
                    [*params, limit],
                )
                rows = list(cursor.fetchall())
        rows.reverse()
        return rows

    def create_message(self, *, chat_id: int, sender_id: int, body: str) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO chat_messages (
                        chat_id,
                        sender_id,
                        message_type,
                        body
                    )
                    VALUES (%s, %s, 'text', %s)
                    RETURNING
                        id,
                        chat_id,
                        sender_id,
                        message_type,
                        body,
                        created_at,
                        read_at
                    """,
                    (chat_id, sender_id, body),
                )
                row = cursor.fetchone()

                cursor.execute(
                    """
                    UPDATE task_chats
                    SET updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (chat_id,),
                )
            connection.commit()
        return row

    def mark_chat_read(self, *, chat_id: int, current_user_id: int) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE chat_messages
                    SET read_at = CURRENT_TIMESTAMP
                    WHERE chat_id = %s
                      AND sender_id <> %s
                      AND read_at IS NULL
                    """,
                    (chat_id, current_user_id),
                )
            connection.commit()

    def _serialize_chat(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "task_id": row["task_id"],
            "customer": {
                "id": row["customer_id"],
                "full_name": row["customer_full_name"],
            },
            "performer": {
                "id": row["performer_id"],
                "full_name": row["performer_full_name"],
            },
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def delete_all_chats(self) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM chat_messages")
                cursor.execute("DELETE FROM task_chats")
            connection.commit()
