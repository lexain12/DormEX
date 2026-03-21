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
