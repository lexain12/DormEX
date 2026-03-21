import uuid
from datetime import timedelta
from typing import Any

from ..core.database import get_connection
from ..core.security import generate_token, hash_token


class AuthRepository:
    def get_university_by_email_domain(self, email_domain: str) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, name, slug, email_domain
                    FROM universities
                    WHERE email_domain = %s
                      AND is_active = TRUE
                    """,
                    (email_domain.lower(),),
                )
                return cursor.fetchone()

    def save_email_verification_code(
        self,
        *,
        email: str,
        code_hash: str,
        university_id: int,
        expires_in_sec: int,
    ) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO email_verification_codes (
                        id,
                        email,
                        code_hash,
                        university_id,
                        expires_at
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        CURRENT_TIMESTAMP + (%s || ' seconds')::interval
                    )
                    """,
                    (str(uuid.uuid4()), email.lower(), code_hash, university_id, expires_in_sec),
                )
            connection.commit()

    def get_active_email_verification_code(self, email: str) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        email,
                        code_hash,
                        university_id,
                        expires_at,
                        used_at
                    FROM email_verification_codes
                    WHERE email = %s
                      AND used_at IS NULL
                      AND expires_at > CURRENT_TIMESTAMP
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (email.lower(),),
                )
                return cursor.fetchone()

    def mark_email_verification_code_used(self, code_id: str) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE email_verification_codes
                    SET used_at = CURRENT_TIMESTAMP
                    WHERE id = %s::uuid
                    """,
                    (code_id,),
                )
            connection.commit()

    def create_session(self, *, user_id: int, user_agent: str | None, ip: str | None) -> dict[str, Any]:
        refresh_token = generate_token(24)
        session_id = str(uuid.uuid4())

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO user_sessions (
                        id,
                        user_id,
                        refresh_token_hash,
                        user_agent,
                        ip,
                        expires_at
                    )
                    VALUES (
                        %s::uuid,
                        %s,
                        %s,
                        %s,
                        %s,
                        CURRENT_TIMESTAMP + INTERVAL '30 days'
                    )
                    """,
                    (session_id, user_id, hash_token(refresh_token), user_agent, ip),
                )
            connection.commit()

        return {
            "access_token": session_id,
            "refresh_token": refresh_token,
        }

    def get_session_by_refresh_token(self, refresh_token: str) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        user_id,
                        expires_at,
                        revoked_at
                    FROM user_sessions
                    WHERE refresh_token_hash = %s
                      AND revoked_at IS NULL
                      AND expires_at > CURRENT_TIMESTAMP
                    """,
                    (hash_token(refresh_token),),
                )
                return cursor.fetchone()

    def rotate_refresh_token(self, *, session_id: str) -> dict[str, Any]:
        refresh_token = generate_token(24)
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE user_sessions
                    SET refresh_token_hash = %s,
                        expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days'
                    WHERE id = %s::uuid
                      AND revoked_at IS NULL
                    RETURNING id
                    """,
                    (hash_token(refresh_token), session_id),
                )
                row = cursor.fetchone()
            connection.commit()

        if row is None:
            raise RuntimeError("Failed to rotate refresh token")

        return {
            "access_token": str(row["id"]),
            "refresh_token": refresh_token,
        }

    def revoke_session(self, *, session_id: str) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE user_sessions
                    SET revoked_at = CURRENT_TIMESTAMP
                    WHERE id = %s::uuid
                    """,
                    (session_id,),
                )
            connection.commit()
