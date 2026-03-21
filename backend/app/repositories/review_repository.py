from typing import Any

from ..core.database import get_connection


class ReviewRepository:
    def list_task_reviews(self, task_id: int) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        task_id,
                        task_assignment_id,
                        author_id,
                        target_user_id,
                        rating,
                        comment,
                        is_visible,
                        moderation_status,
                        created_at,
                        updated_at
                    FROM reviews
                    WHERE task_id = %s
                    ORDER BY created_at DESC
                    """,
                    (task_id,),
                )
                return list(cursor.fetchall())

    def get_review(self, review_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        task_id,
                        task_assignment_id,
                        author_id,
                        target_user_id,
                        rating,
                        comment,
                        is_visible,
                        moderation_status,
                        created_at,
                        updated_at
                    FROM reviews
                    WHERE id = %s
                    """,
                    (review_id,),
                )
                return cursor.fetchone()

    def create_review(
        self,
        *,
        task_id: int,
        task_assignment_id: int,
        author_id: int,
        target_user_id: int,
        rating: int,
        comment: str | None,
    ) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO reviews (
                        task_id,
                        task_assignment_id,
                        author_id,
                        target_user_id,
                        rating,
                        comment
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING
                        id,
                        task_id,
                        task_assignment_id,
                        author_id,
                        target_user_id,
                        rating,
                        comment,
                        is_visible,
                        moderation_status,
                        created_at,
                        updated_at
                    """,
                    (task_id, task_assignment_id, author_id, target_user_id, rating, comment),
                )
                row = cursor.fetchone()
            connection.commit()
        return row

    def update_review(self, *, review_id: int, rating: int, comment: str | None) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE reviews
                    SET
                        rating = %s,
                        comment = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING
                        id,
                        task_id,
                        task_assignment_id,
                        author_id,
                        target_user_id,
                        rating,
                        comment,
                        is_visible,
                        moderation_status,
                        created_at,
                        updated_at
                    """,
                    (rating, comment, review_id),
                )
                row = cursor.fetchone()
            connection.commit()
        return row

    def list_pending_reviews(self) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        task_id,
                        task_assignment_id,
                        author_id,
                        target_user_id,
                        rating,
                        comment,
                        is_visible,
                        moderation_status,
                        created_at,
                        updated_at
                    FROM reviews
                    WHERE moderation_status = 'pending'
                    ORDER BY created_at ASC
                    """,
                )
                return list(cursor.fetchall())

    def set_review_moderation(self, *, review_id: int, moderation_status: str, is_visible: bool) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE reviews
                    SET
                        moderation_status = %s,
                        is_visible = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING
                        id,
                        task_id,
                        task_assignment_id,
                        author_id,
                        target_user_id,
                        rating,
                        comment,
                        is_visible,
                        moderation_status,
                        created_at,
                        updated_at
                    """,
                    (moderation_status, is_visible, review_id),
                )
                row = cursor.fetchone()
            connection.commit()
        return row
