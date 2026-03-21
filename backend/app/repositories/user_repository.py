from datetime import datetime
from typing import Any

from ..core.database import get_connection


class UserRepository:
    def get_user_context(self, user_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        email,
                        full_name,
                        role,
                        university_id,
                        dormitory_id,
                        is_blocked
                    FROM users
                    WHERE id = %s
                    """,
                    (user_id,),
                )
                return cursor.fetchone()

    def get_user_context_by_session(self, session_id: str) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        u.id,
                        u.email,
                        u.full_name,
                        u.role,
                        u.university_id,
                        u.dormitory_id,
                        u.is_blocked
                    FROM user_sessions s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.id = %s::uuid
                      AND s.revoked_at IS NULL
                      AND s.expires_at > CURRENT_TIMESTAMP
                    """,
                    (session_id,),
                )
                return cursor.fetchone()

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        u.id,
                        u.email,
                        u.email_verified_at,
                        u.full_name,
                        u.avatar_url,
                        u.role,
                        u.university_id,
                        u.dormitory_id,
                        u.room_label,
                        u.bio,
                        u.rating_avg,
                        u.reviews_count,
                        u.completed_tasks_count,
                        u.created_tasks_count,
                        u.is_blocked,
                        uni.name AS university_name,
                        d.name AS dormitory_name
                    FROM users u
                    JOIN universities uni ON uni.id = u.university_id
                    LEFT JOIN dormitories d ON d.id = u.dormitory_id
                    WHERE u.email = %s
                    """,
                    (email,),
                )
                return cursor.fetchone()

    def create_user(self, *, email: str, university_id: int, full_name: str) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO users (
                        email,
                        email_verified_at,
                        full_name,
                        university_id
                    )
                    VALUES (%s, CURRENT_TIMESTAMP, %s, %s)
                    RETURNING id
                    """,
                    (email, full_name, university_id),
                )
                row = cursor.fetchone()
            connection.commit()

        if row is None:
            raise RuntimeError("Failed to create user")

        user = self.get_user_context(row["id"])
        if user is None:
            raise RuntimeError("Failed to load created user")
        return user

    def mark_email_verified(self, *, user_id: int) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE users
                    SET email_verified_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (user_id,),
                )
            connection.commit()

    def get_me_profile(self, user_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        u.id,
                        u.email,
                        u.full_name,
                        u.avatar_url,
                        u.role,
                        u.room_label,
                        u.bio,
                        u.university_id,
                        u.dormitory_id,
                        uni.name AS university_name,
                        d.name AS dormitory_name
                    FROM users u
                    JOIN universities uni ON uni.id = u.university_id
                    LEFT JOIN dormitories d ON d.id = u.dormitory_id
                    WHERE u.id = %s
                    """,
                    (user_id,),
                )
                return cursor.fetchone()

    def update_me_profile(
        self,
        *,
        user_id: int,
        full_name: str,
        dormitory_id: int | None,
        room_label: str | None,
        bio: str | None,
    ) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE users u
                    SET
                        full_name = %s,
                        dormitory_id = d.id,
                        room_label = %s,
                        bio = %s,
                        updated_at = CURRENT_TIMESTAMP
                    FROM dormitories d
                    WHERE u.id = %s
                      AND d.id = %s
                      AND d.university_id = u.university_id
                    RETURNING u.id
                    """,
                    (full_name, room_label, bio, user_id, dormitory_id),
                )
                row = cursor.fetchone()
            connection.commit()

        if dormitory_id is None:
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        UPDATE users
                        SET
                            full_name = %s,
                            dormitory_id = NULL,
                            room_label = %s,
                            bio = %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                        RETURNING id
                        """,
                        (full_name, room_label, bio, user_id),
                    )
                    row = cursor.fetchone()
                connection.commit()

        if row is None:
            return None
        return self.get_me_profile(user_id)

    def list_dormitories_for_university(self, university_id: int) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        name,
                        code,
                        address,
                        is_active,
                        created_at
                    FROM dormitories
                    WHERE university_id = %s
                      AND is_active = TRUE
                    ORDER BY name
                    """,
                    (university_id,),
                )
                return list(cursor.fetchall())

    def get_public_profile(self, user_id: int) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        u.id,
                        u.full_name,
                        u.avatar_url,
                        u.rating_avg,
                        u.reviews_count,
                        u.completed_tasks_count,
                        u.created_tasks_count,
                        u.email_verified_at,
                        d.id AS dormitory_id,
                        d.name AS dormitory_name
                    FROM users u
                    LEFT JOIN dormitories d ON d.id = u.dormitory_id
                    WHERE u.id = %s
                    """,
                    (user_id,),
                )
                return cursor.fetchone()

    def list_user_reviews(self, user_id: int) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        r.id,
                        r.task_id,
                        r.task_assignment_id,
                        r.author_id,
                        au.full_name AS author_full_name,
                        r.target_user_id,
                        r.rating,
                        r.comment,
                        r.created_at,
                        r.updated_at
                    FROM reviews r
                    JOIN users au ON au.id = r.author_id
                    WHERE r.target_user_id = %s
                      AND r.is_visible = TRUE
                      AND r.moderation_status IN ('pending', 'approved')
                    ORDER BY r.created_at DESC
                    """,
                    (user_id,),
                )
                return list(cursor.fetchall())

    def list_user_tasks(
        self,
        *,
        user_id: int,
        role: str,
        status: str | None,
    ) -> list[dict[str, Any]]:
        status_condition = ""
        params: list[Any] = [user_id]

        if role == "customer":
            role_join = ""
            role_where = "t.customer_id = %s"
        else:
            role_join = "JOIN task_assignments ta ON ta.task_id = t.id"
            role_where = "ta.performer_id = %s"

        if status == "active":
            status_condition = "AND t.status IN ('open', 'offers', 'in_progress')"
        elif status == "completed":
            status_condition = "AND t.status = 'completed'"
        elif status == "cancelled":
            status_condition = "AND t.status = 'cancelled'"

        query = f"""
            SELECT
                t.id,
                t.title,
                t.category,
                t.urgency,
                t.payment_type,
                t.price_amount,
                t.status,
                t.offers_count,
                t.created_at
            FROM tasks t
            {role_join}
            WHERE {role_where}
            {status_condition}
            ORDER BY t.created_at DESC
        """

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                return list(cursor.fetchall())

    def update_user_rating_summary(self, user_id: int) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE users u
                    SET
                        rating_avg = COALESCE(stats.rating_avg, 0),
                        reviews_count = COALESCE(stats.reviews_count, 0),
                        updated_at = CURRENT_TIMESTAMP
                    FROM (
                        SELECT
                            target_user_id,
                            ROUND(AVG(rating)::numeric, 2) AS rating_avg,
                            COUNT(*) AS reviews_count
                        FROM reviews
                        WHERE target_user_id = %s
                          AND is_visible = TRUE
                          AND moderation_status IN ('pending', 'approved')
                        GROUP BY target_user_id
                    ) stats
                    WHERE u.id = %s
                    """,
                    (user_id, user_id),
                )
            connection.commit()

    def increment_created_tasks_count(self, user_id: int) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE users
                    SET created_tasks_count = created_tasks_count + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (user_id,),
                )
            connection.commit()

    def increment_completed_tasks_count(self, user_ids: list[int]) -> None:
        unique_user_ids = sorted(set(user_ids))
        if not unique_user_ids:
            return

        placeholders = ", ".join(["%s"] * len(unique_user_ids))
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    UPDATE users
                    SET completed_tasks_count = completed_tasks_count + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id IN ({placeholders})
                    """,
                    unique_user_ids,
                )
            connection.commit()
