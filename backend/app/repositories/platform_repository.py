import json
import os
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Any
from uuid import uuid4

from ..core.auth_tokens import hash_refresh_token, hash_verification_code
from ..core.database import get_connection
from ..core.exceptions import AuthenticationError, DomainValidationError, ForbiddenError, TooManyRequestsError
from ..core.security import hash_password, verify_password


UTC = timezone.utc


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class PlatformRepository:
    demo_email_domain = "campus.test"
    default_university_domain = "phystech.edu"

    def __init__(self) -> None:
        self.email_code_ttl_sec = int(os.getenv("EMAIL_CODE_TTL_SEC", "600"))
        self.email_code_resend_interval_sec = int(os.getenv("EMAIL_CODE_RESEND_INTERVAL_SEC", "60"))
        self.auth_allow_any_email_domain = _parse_bool(os.getenv("AUTH_ALLOW_ANY_EMAIL_DOMAIN"), default=False)
        self.admin_email = (os.getenv("ADMIN_EMAIL", "admin@campus.test") or "").strip().lower()
        self.admin_username = (os.getenv("ADMIN_USERNAME", "admin") or "").strip().lower()
        self.admin_password = (os.getenv("ADMIN_PASSWORD", "123") or "").strip()
        self.admin_full_name = (os.getenv("ADMIN_FULL_NAME", "Администратор DormEX") or "").strip()

    def ensure_seed_data(self) -> None:
        # Demo/reset data is now owned by Liquibase changesets.
        return None

    def create_email_code(self, email: str, university_id: int, code: str) -> dict[str, Any]:
        normalized_email = email.lower().strip()
        now = datetime.now(UTC)
        expires_at = now + timedelta(seconds=self.email_code_ttl_sec)
        code_id = str(uuid4())

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT created_at
                    FROM email_verification_codes
                    WHERE email = %s
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (normalized_email,),
                )
                latest_request = cursor.fetchone()

                if latest_request is not None:
                    seconds_since_last_request = (now - latest_request["created_at"]).total_seconds()
                    if seconds_since_last_request < self.email_code_resend_interval_sec:
                        retry_after_sec = ceil(self.email_code_resend_interval_sec - seconds_since_last_request)
                        raise TooManyRequestsError(
                            f"Повторный запрос кода можно отправить через {retry_after_sec} сек."
                        )

                cursor.execute(
                    """
                    UPDATE email_verification_codes
                    SET used_at = CURRENT_TIMESTAMP
                    WHERE email = %s
                      AND used_at IS NULL
                    """,
                    (normalized_email,),
                )
                cursor.execute(
                    """
                    INSERT INTO email_verification_codes (
                        id,
                        email,
                        code_hash,
                        university_id,
                        expires_at
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        code_id,
                        normalized_email,
                        hash_verification_code(code),
                        university_id,
                        expires_at,
                    ),
                )
            connection.commit()

        return {
            "id": code_id,
            "status": "code_sent",
            "expires_in_sec": self.email_code_ttl_sec,
        }

    def invalidate_email_code(self, code_id: str) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE email_verification_codes
                    SET used_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                      AND used_at IS NULL
                    """,
                    (code_id,),
                )
            connection.commit()

    def get_university_by_email(self, email: str) -> dict[str, Any] | None:
        domain = email.lower().split("@")[-1].strip()

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, name, slug, email_domain
                    FROM universities
                    WHERE email_domain = %s
                      AND is_active = TRUE
                    """,
                    (domain,),
                )
                university = cursor.fetchone()
                if university is not None:
                    return university

                if not self.auth_allow_any_email_domain:
                    return None

                cursor.execute(
                    """
                    SELECT id, name, slug, email_domain
                    FROM universities
                    WHERE email_domain = %s
                      AND is_active = TRUE
                    """,
                    (self.demo_email_domain,),
                )
                return cursor.fetchone()

    def verify_email_code_and_get_user(self, email: str, code: str) -> dict[str, Any]:
        email = email.lower().strip()
        normalized_code = code.strip()

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, university_id, code_hash
                    FROM email_verification_codes
                    WHERE email = %s
                      AND used_at IS NULL
                      AND expires_at > CURRENT_TIMESTAMP
                    ORDER BY created_at DESC
                    LIMIT 1
                    FOR UPDATE
                    """,
                    (email,),
                )
                code_row = cursor.fetchone()

                if code_row is None:
                    raise DomainValidationError("Код подтверждения просрочен или не запрошен")

                if code_row["code_hash"] != hash_verification_code(normalized_code):
                    raise DomainValidationError("Неверный код подтверждения")

                cursor.execute(
                    """
                    UPDATE email_verification_codes
                    SET used_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (code_row["id"],),
                )

                cursor.execute(
                    """
                    SELECT id
                    FROM users
                    WHERE email = %s
                    """,
                    (email,),
                )
                user_row = cursor.fetchone()

                if user_row is None:
                    local_part = email.split("@")[0].replace(".", " ").replace("_", " ").strip()
                    fallback_name = local_part.title() if local_part else "Новый пользователь"

                    cursor.execute(
                        """
                        INSERT INTO users (
                            email,
                            email_verified_at,
                            full_name,
                            role,
                            university_id
                        )
                        VALUES (%s, CURRENT_TIMESTAMP, %s, 'user', %s)
                        RETURNING id
                        """,
                        (email, fallback_name, code_row["university_id"]),
                    )
                    user_id = cursor.fetchone()["id"]
                else:
                    user_id = user_row["id"]
                    cursor.execute(
                        """
                        UPDATE users
                        SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                        """,
                        (user_id,),
                    )

            connection.commit()

        return self.get_me(user_id)

    def verify_credentials_and_get_user(self, username: str, password: str) -> dict[str, Any]:
        normalized_username = username.lower().strip()

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, password_hash, is_blocked
                    FROM users
                    WHERE username = %s
                    """,
                    (normalized_username,),
                )
                user_row = cursor.fetchone()

        if user_row is None or not verify_password(password, user_row["password_hash"]):
            raise AuthenticationError("Неверный логин или пароль")

        if user_row["is_blocked"]:
            raise AuthenticationError("Пользователь заблокирован")

        return self.get_me(user_row["id"])

    def register_user(
        self,
        *,
        email: str,
        username: str,
        password: str,
        dormitory_id: int,
        full_name: str | None,
    ) -> dict[str, Any]:
        normalized_email = email.lower().strip()
        normalized_username = username.lower().strip()
        normalized_full_name = (full_name or "").strip()

        university = self.get_university_by_email(normalized_email)
        if university is None:
            raise DomainValidationError("Этот email-домен не привязан к университету")

        fallback_name = normalized_username.replace(".", " ").replace("_", " ").replace("-", " ").strip().title()
        final_full_name = normalized_full_name or fallback_name or "Новый пользователь"

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT 1
                    FROM users
                    WHERE email = %s
                    """,
                    (normalized_email,),
                )
                if cursor.fetchone() is not None:
                    raise DomainValidationError("Пользователь с таким email уже существует")

                cursor.execute(
                    """
                    SELECT 1
                    FROM users
                    WHERE username = %s
                    """,
                    (normalized_username,),
                )
                if cursor.fetchone() is not None:
                    raise DomainValidationError("Логин уже занят")

                cursor.execute(
                    """
                    SELECT 1
                    FROM dormitories
                    WHERE id = %s
                      AND university_id = %s
                      AND is_active = TRUE
                    """,
                    (dormitory_id, university["id"]),
                )
                if cursor.fetchone() is None:
                    raise DomainValidationError("Выберите общежитие из списка")

                cursor.execute(
                    """
                    INSERT INTO users (
                        email,
                        username,
                        password_hash,
                        full_name,
                        role,
                        university_id,
                        dormitory_id
                    )
                    VALUES (%s, %s, %s, %s, 'user', %s, %s)
                    RETURNING id
                    """,
                    (
                        normalized_email,
                        normalized_username,
                        hash_password(password),
                        final_full_name,
                        university["id"],
                        dormitory_id,
                    ),
                )
                user_row = cursor.fetchone()
            connection.commit()

        if user_row is None:
            raise RuntimeError("Не удалось создать пользователя")

        return self.get_me(user_row["id"])

    def create_admin_account(
        self,
        *,
        email: str,
        username: str,
        password: str,
        full_name: str | None,
    ) -> dict[str, Any]:
        normalized_email = email.lower().strip()
        normalized_username = username.lower().strip()
        normalized_full_name = (full_name or "").strip()

        university = self.get_university_by_email(normalized_email)
        if university is None:
            raise DomainValidationError("Этот email-домен не привязан к университету")

        fallback_name = normalized_username.replace(".", " ").replace("_", " ").replace("-", " ").strip().title()
        final_full_name = normalized_full_name or fallback_name or "Администратор"

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT 1
                    FROM users
                    WHERE email = %s
                    """,
                    (normalized_email,),
                )
                if cursor.fetchone() is not None:
                    raise DomainValidationError("Пользователь с таким email уже существует")

                cursor.execute(
                    """
                    SELECT 1
                    FROM users
                    WHERE username = %s
                    """,
                    (normalized_username,),
                )
                if cursor.fetchone() is not None:
                    raise DomainValidationError("Логин уже занят")

                cursor.execute(
                    """
                    INSERT INTO users (
                        email,
                        email_verified_at,
                        username,
                        password_hash,
                        full_name,
                        role,
                        university_id
                    )
                    VALUES (%s, CURRENT_TIMESTAMP, %s, %s, %s, 'admin', %s)
                    RETURNING id
                    """,
                    (
                        normalized_email,
                        normalized_username,
                        hash_password(password),
                        final_full_name,
                        university["id"],
                    ),
                )
                row = cursor.fetchone()
            connection.commit()

        if row is None:
            raise RuntimeError("Не удалось создать административный аккаунт")

        return self.get_me(row["id"])

    def delete_user_completely(self, user_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, email, role, university_id
                    FROM users
                    WHERE id = %s
                    FOR UPDATE
                    """,
                    (user_id,),
                )
                user = cursor.fetchone()
                if user is None:
                    raise DomainValidationError("Пользователь не найден")

                cursor.execute(
                    """
                    SELECT id
                    FROM tasks
                    WHERE customer_id = %s
                    """,
                    (user_id,),
                )
                own_task_ids = [row["id"] for row in cursor.fetchall()]

                own_task_offer_ids: list[int] = []
                if own_task_ids:
                    cursor.execute(
                        """
                        SELECT id
                        FROM task_offers
                        WHERE task_id = ANY(%s)
                        """,
                        (own_task_ids,),
                    )
                    own_task_offer_ids = [row["id"] for row in cursor.fetchall()]

                cursor.execute(
                    """
                    SELECT id, task_id
                    FROM task_offers
                    WHERE performer_id = %s
                    """,
                    (user_id,),
                )
                performer_offer_rows = list(cursor.fetchall())
                performer_offer_ids = [row["id"] for row in performer_offer_rows]
                performer_task_ids = [row["task_id"] for row in performer_offer_rows]

                offer_ids_to_delete = list(dict.fromkeys(own_task_offer_ids + performer_offer_ids))
                task_ids_to_reset = list(
                    dict.fromkeys(
                        task_id
                        for task_id in performer_task_ids
                        if task_id not in own_task_ids
                    )
                )

                assignment_ids_to_delete: list[int] = []
                assignment_task_ids: list[int] = []
                assignment_params: list[Any] = [user_id, user_id]
                assignment_conditions = ["customer_id = %s", "performer_id = %s"]
                if own_task_ids:
                    assignment_conditions.append("task_id = ANY(%s)")
                    assignment_params.append(own_task_ids)
                if offer_ids_to_delete:
                    assignment_conditions.append("offer_id = ANY(%s)")
                    assignment_params.append(offer_ids_to_delete)

                cursor.execute(
                    f"""
                    SELECT id, task_id
                    FROM task_assignments
                    WHERE {" OR ".join(assignment_conditions)}
                    """,
                    tuple(assignment_params),
                )
                for row in cursor.fetchall():
                    assignment_ids_to_delete.append(row["id"])
                    if row["task_id"] not in own_task_ids:
                        assignment_task_ids.append(row["task_id"])

                task_ids_to_reset = list(dict.fromkeys(task_ids_to_reset + assignment_task_ids))

                chat_params: list[Any] = [user_id, user_id]
                chat_conditions = ["customer_id = %s", "performer_id = %s"]
                if own_task_ids:
                    chat_conditions.append("task_id = ANY(%s)")
                    chat_params.append(own_task_ids)

                cursor.execute(
                    f"""
                    SELECT id
                    FROM task_chats
                    WHERE {" OR ".join(chat_conditions)}
                    """,
                    tuple(chat_params),
                )
                chat_ids = [row["id"] for row in cursor.fetchall()]

                chat_message_ids: list[int] = []
                if chat_ids:
                    cursor.execute(
                        """
                        SELECT id
                        FROM chat_messages
                        WHERE chat_id = ANY(%s)
                        """,
                        (chat_ids,),
                    )
                    chat_message_ids = [row["id"] for row in cursor.fetchall()]

                review_params: list[Any] = [user_id, user_id]
                review_conditions = ["author_id = %s", "target_user_id = %s"]
                if own_task_ids:
                    review_conditions.append("task_id = ANY(%s)")
                    review_params.append(own_task_ids)
                if assignment_ids_to_delete:
                    review_conditions.append("task_assignment_id = ANY(%s)")
                    review_params.append(assignment_ids_to_delete)

                cursor.execute(
                    f"""
                    SELECT id
                    FROM reviews
                    WHERE {" OR ".join(review_conditions)}
                    """,
                    tuple(review_params),
                )
                review_ids = [row["id"] for row in cursor.fetchall()]

                if offer_ids_to_delete:
                    cursor.execute(
                        """
                        UPDATE tasks
                        SET accepted_offer_id = NULL,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE accepted_offer_id = ANY(%s)
                        """,
                        (offer_ids_to_delete,),
                    )

                report_conditions = ["reporter_id = %s", "resolved_by_user_id = %s", "(target_type = 'user' AND target_id = %s)"]
                report_params: list[Any] = [user_id, user_id, user_id]
                if own_task_ids:
                    report_conditions.append("(target_type = 'task' AND target_id = ANY(%s))")
                    report_params.append(own_task_ids)
                if review_ids:
                    report_conditions.append("(target_type = 'review' AND target_id = ANY(%s))")
                    report_params.append(review_ids)
                if chat_message_ids:
                    report_conditions.append("(target_type = 'chat_message' AND target_id = ANY(%s))")
                    report_params.append(chat_message_ids)
                cursor.execute(
                    f"""
                    DELETE FROM reports
                    WHERE {" OR ".join(report_conditions)}
                    """,
                    tuple(report_params),
                )

                audit_conditions = ["actor_user_id = %s", "(entity_type = 'user' AND entity_id = %s)"]
                audit_params: list[Any] = [user_id, user_id]
                if own_task_ids:
                    audit_conditions.append("(entity_type = 'task' AND entity_id = ANY(%s))")
                    audit_params.append(own_task_ids)
                if review_ids:
                    audit_conditions.append("(entity_type = 'review' AND entity_id = ANY(%s))")
                    audit_params.append(review_ids)
                if chat_message_ids:
                    audit_conditions.append("(entity_type = 'chat_message' AND entity_id = ANY(%s))")
                    audit_params.append(chat_message_ids)
                cursor.execute(
                    f"""
                    DELETE FROM audit_logs
                    WHERE {" OR ".join(audit_conditions)}
                    """,
                    tuple(audit_params),
                )

                notification_conditions = ["user_id = %s", "(entity_type = 'user' AND entity_id = %s)"]
                notification_params: list[Any] = [user_id, user_id]
                if own_task_ids:
                    notification_conditions.append("(entity_type = 'task' AND entity_id = ANY(%s))")
                    notification_params.append(own_task_ids)
                if offer_ids_to_delete:
                    notification_conditions.append("(entity_type = 'offer' AND entity_id = ANY(%s))")
                    notification_params.append(offer_ids_to_delete)
                if review_ids:
                    notification_conditions.append("(entity_type = 'review' AND entity_id = ANY(%s))")
                    notification_params.append(review_ids)
                if chat_message_ids:
                    notification_conditions.append("(entity_type = 'chat_message' AND entity_id = ANY(%s))")
                    notification_params.append(chat_message_ids)
                cursor.execute(
                    f"""
                    DELETE FROM notifications
                    WHERE {" OR ".join(notification_conditions)}
                    """,
                    tuple(notification_params),
                )

                if assignment_ids_to_delete:
                    cursor.execute(
                        """
                        DELETE FROM task_completion_confirmations
                        WHERE task_assignment_id = ANY(%s)
                           OR dispute_opened_by_user_id = %s
                        """,
                        (assignment_ids_to_delete, user_id),
                    )
                else:
                    cursor.execute(
                        """
                        DELETE FROM task_completion_confirmations
                        WHERE dispute_opened_by_user_id = %s
                        """,
                        (user_id,),
                    )

                if review_ids:
                    cursor.execute(
                        """
                        DELETE FROM reviews
                        WHERE id = ANY(%s)
                        """,
                        (review_ids,),
                    )

                if chat_ids:
                    cursor.execute(
                        """
                        DELETE FROM task_chats
                        WHERE id = ANY(%s)
                        """,
                        (chat_ids,),
                    )

                if assignment_ids_to_delete:
                    cursor.execute(
                        """
                        DELETE FROM task_assignments
                        WHERE id = ANY(%s)
                        """,
                        (assignment_ids_to_delete,),
                    )

                if offer_ids_to_delete:
                    cursor.execute(
                        """
                        DELETE FROM offer_counter_offers
                        WHERE author_user_id = %s
                           OR offer_id = ANY(%s)
                        """,
                        (user_id, offer_ids_to_delete),
                    )
                    cursor.execute(
                        """
                        DELETE FROM task_offers
                        WHERE id = ANY(%s)
                        """,
                        (offer_ids_to_delete,),
                    )
                else:
                    cursor.execute(
                        """
                        DELETE FROM offer_counter_offers
                        WHERE author_user_id = %s
                        """,
                        (user_id,),
                    )

                if own_task_ids:
                    cursor.execute(
                        """
                        DELETE FROM tasks
                        WHERE id = ANY(%s)
                        """,
                        (own_task_ids,),
                    )

                cursor.execute("DELETE FROM notification_preferences WHERE user_id = %s", (user_id,))
                cursor.execute("DELETE FROM web_push_subscriptions WHERE user_id = %s", (user_id,))
                cursor.execute("DELETE FROM user_sessions WHERE user_id = %s", (user_id,))
                cursor.execute("DELETE FROM email_verification_codes WHERE email = %s", (user["email"],))

                cursor.execute(
                    """
                    DELETE FROM users
                    WHERE id = %s
                    """,
                    (user_id,),
                )

                for task_id in task_ids_to_reset:
                    self._reset_task_after_user_cleanup(cursor, task_id)

                cursor.execute(
                    """
                    SELECT id
                    FROM users
                    WHERE university_id = %s
                    """,
                    (user["university_id"],),
                )
                remaining_user_ids = [row["id"] for row in cursor.fetchall()]
                self._refresh_user_metrics(cursor, remaining_user_ids)

            connection.commit()

        return {
            "status": "deleted",
            "user_id": user_id,
        }

    def _ensure_dormitories(
        self,
        cursor: Any,
        *,
        university_id: int,
        address_prefix: str,
    ) -> dict[str, int]:
        dormitory_ids: dict[str, int] = {}
        for name, code in (
            ("Общежитие №1", "D1"),
            ("Общежитие №2", "D2"),
            ("Общежитие №3", "D3"),
        ):
            cursor.execute(
                """
                INSERT INTO dormitories (university_id, name, code, address)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (university_id, name)
                DO UPDATE SET
                    code = EXCLUDED.code,
                    address = EXCLUDED.address
                RETURNING id
                """,
                (university_id, name, code, f"{address_prefix}, {name}"),
            )
            dormitory_ids[name] = cursor.fetchone()["id"]
        return dormitory_ids

    def create_refresh_session(
        self,
        user_id: int,
        refresh_token: str,
        *,
        user_agent: str | None,
        ip: str | None,
    ) -> None:
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
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        str(uuid4()),
                        user_id,
                        hash_refresh_token(refresh_token),
                        user_agent,
                        ip,
                        datetime.now(UTC) + timedelta(days=30),
                    ),
                )
            connection.commit()

    def get_session_user(self, refresh_token: str) -> dict[str, Any] | None:
        token_hash = hash_refresh_token(refresh_token)

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT u.id AS user_id
                    FROM user_sessions s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.refresh_token_hash = %s
                      AND s.revoked_at IS NULL
                      AND s.expires_at > CURRENT_TIMESTAMP
                    ORDER BY s.created_at DESC
                    LIMIT 1
                    """,
                    (token_hash,),
                )
                return cursor.fetchone()

    def revoke_refresh_session(self, refresh_token: str) -> None:
        token_hash = hash_refresh_token(refresh_token)

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE user_sessions
                    SET revoked_at = CURRENT_TIMESTAMP
                    WHERE refresh_token_hash = %s
                      AND revoked_at IS NULL
                    """,
                    (token_hash,),
                )
            connection.commit()

    def get_me(self, user_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        u.id,
                        u.email,
                        u.full_name,
                        u.role,
                        u.room_label,
                        u.bio,
                        u.dormitory_id,
                        u.university_id,
                        uni.name AS university_name,
                        d.name AS dormitory_name
                    FROM users u
                    JOIN universities uni ON uni.id = u.university_id
                    LEFT JOIN dormitories d ON d.id = u.dormitory_id
                    WHERE u.id = %s
                    """,
                    (user_id,),
                )
                row = cursor.fetchone()

        if row is None:
            raise DomainValidationError("Пользователь не найден")

        return self._serialize_me(row)

    def update_me(
        self,
        user_id: int,
        *,
        full_name: str,
        dormitory_id: int,
        room_label: str | None,
        bio: str | None,
    ) -> dict[str, Any]:
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
                    (full_name.strip(), room_label, bio, user_id, dormitory_id),
                )
                updated = cursor.fetchone()
                if updated is None:
                    raise DomainValidationError("Общежитие не найдено в вашем университете")
            connection.commit()

        return self.get_me(user_id)

    def list_dormitories(self, university_id: int) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, name
                    FROM dormitories
                    WHERE university_id = %s
                      AND is_active = TRUE
                    ORDER BY id
                    """,
                    (university_id,),
                )
                return list(cursor.fetchall())

    def _ensure_user_visible_in_university(
        self,
        cursor,
        *,
        user_id: int,
        current_university_id: int,
    ) -> None:
        cursor.execute(
            """
            SELECT 1
            FROM users
            WHERE id = %s
              AND university_id = %s
            """,
            (user_id, current_university_id),
        )
        if cursor.fetchone() is None:
            raise DomainValidationError("Пользователь не найден")

    def get_user_profile(self, user_id: int, *, current_university_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                self._ensure_user_visible_in_university(
                    cursor,
                    user_id=user_id,
                    current_university_id=current_university_id,
                )
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
                        d.id AS dormitory_id,
                        d.name AS dormitory_name,
                        customer_reviews.rating_avg AS customer_rating_avg,
                        customer_reviews.reviews_count AS customer_reviews_count,
                        customer_tasks.completed_tasks_count AS customer_completed_tasks_count,
                        performer_reviews.rating_avg AS performer_rating_avg,
                        performer_reviews.reviews_count AS performer_reviews_count,
                        performer_tasks.completed_tasks_count AS performer_completed_tasks_count
                    FROM users u
                    LEFT JOIN dormitories d ON d.id = u.dormitory_id
                    LEFT JOIN LATERAL (
                        SELECT
                            COUNT(*) AS reviews_count,
                            ROUND(AVG(r.rating)::numeric, 2) AS rating_avg
                        FROM reviews r
                        JOIN task_assignments a ON a.id = r.task_assignment_id
                        WHERE r.target_user_id = u.id
                          AND r.is_visible = TRUE
                          AND a.customer_id = u.id
                    ) AS customer_reviews ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT COUNT(*) AS completed_tasks_count
                        FROM task_assignments a
                        WHERE a.customer_id = u.id
                          AND a.status = 'completed'
                    ) AS customer_tasks ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT
                            COUNT(*) AS reviews_count,
                            ROUND(AVG(r.rating)::numeric, 2) AS rating_avg
                        FROM reviews r
                        JOIN task_assignments a ON a.id = r.task_assignment_id
                        WHERE r.target_user_id = u.id
                          AND r.is_visible = TRUE
                          AND a.performer_id = u.id
                    ) AS performer_reviews ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT COUNT(*) AS completed_tasks_count
                        FROM task_assignments a
                        WHERE a.performer_id = u.id
                          AND a.status = 'completed'
                    ) AS performer_tasks ON TRUE
                    WHERE u.id = %s
                      AND u.university_id = %s
                    """,
                    (user_id, current_university_id),
                )
                row = cursor.fetchone()

        if row is None:
            raise DomainValidationError("Пользователь не найден")

        badges: list[str] = []
        if row["dormitory_id"]:
            badges.append("verified_user")
        if float(row["rating_avg"] or 0) >= 4.5 and int(row["reviews_count"] or 0) > 0:
            badges.append("fast_responder")
        if int(row["completed_tasks_count"] or 0) >= 1:
            badges.append("completed_tasks")

        return {
            "id": row["id"],
            "full_name": row["full_name"],
            "avatar_url": row["avatar_url"],
            "dormitory": None if row["dormitory_id"] is None else {
                "id": row["dormitory_id"],
                "name": row["dormitory_name"],
            },
            "rating_avg": float(row["rating_avg"] or 0),
            "reviews_count": row["reviews_count"],
            "completed_tasks_count": row["completed_tasks_count"],
            "created_tasks_count": row["created_tasks_count"],
            "customer_metrics": {
                "rating_avg": float(row["customer_rating_avg"] or 0),
                "reviews_count": int(row["customer_reviews_count"] or 0),
                "completed_tasks_count": int(row["customer_completed_tasks_count"] or 0),
            },
            "performer_metrics": {
                "rating_avg": float(row["performer_rating_avg"] or 0),
                "reviews_count": int(row["performer_reviews_count"] or 0),
                "completed_tasks_count": int(row["performer_completed_tasks_count"] or 0),
            },
            "badges": badges,
        }

    def list_user_reviews(self, user_id: int, *, current_university_id: int) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                self._ensure_user_visible_in_university(
                    cursor,
                    user_id=user_id,
                    current_university_id=current_university_id,
                )
                cursor.execute(
                    """
                    SELECT
                        r.id,
                        r.rating,
                        r.comment,
                        r.created_at,
                        r.task_id,
                        t.title AS task_title,
                        a.id AS author_id,
                        a.full_name AS author_full_name,
                        CASE
                            WHEN assignment.customer_id = r.author_id THEN 'customer'
                            ELSE 'performer'
                        END AS author_role,
                        CASE
                            WHEN assignment.customer_id = r.target_user_id THEN 'customer'
                            ELSE 'performer'
                        END AS target_role
                    FROM reviews r
                    JOIN users a ON a.id = r.author_id
                    JOIN users target_user ON target_user.id = r.target_user_id
                    JOIN task_assignments assignment ON assignment.id = r.task_assignment_id
                    JOIN tasks t ON t.id = r.task_id
                    WHERE r.target_user_id = %s
                      AND r.is_visible = TRUE
                      AND target_user.university_id = %s
                      AND t.university_id = %s
                    ORDER BY r.created_at DESC, r.id DESC
                    """,
                    (user_id, current_university_id, current_university_id),
                )
                rows = list(cursor.fetchall())

        return [
            {
                "id": row["id"],
                "rating": row["rating"],
                "comment": row["comment"],
                "created_at": row["created_at"],
                "task_id": row["task_id"],
                "task_title": row["task_title"],
                "author_role": row["author_role"],
                "target_role": row["target_role"],
                "author": {
                    "id": row["author_id"],
                    "full_name": row["author_full_name"],
                },
            }
            for row in rows
        ]

    def list_tasks(
        self,
        *,
        current_user_id: int,
        current_university_id: int,
        current_dormitory_id: int | None,
        filters: dict[str, Any],
        limit: int,
        offset: int,
    ) -> dict[str, Any]:
        conditions = ["t.university_id = %s"]
        params: list[Any] = [current_university_id]

        if filters.get("scope") == "dormitory":
            dormitory_id = filters.get("dormitory_id") or current_dormitory_id
            if dormitory_id is None:
                raise DomainValidationError("Для фильтрации по общежитию требуется dormitory_id")
            conditions.append("t.dormitory_id = %s")
            params.append(dormitory_id)
        elif filters.get("dormitory_id") is not None:
            conditions.append("t.dormitory_id = %s")
            params.append(filters["dormitory_id"])

        for field_name in ("category", "urgency", "payment_type"):
            if filters.get(field_name) is not None:
                conditions.append(f"t.{field_name} = %s")
                params.append(filters[field_name])

        if filters.get("status") is not None:
            conditions.append("t.status = %s")
            params.append(filters["status"])
        else:
            conditions.append("t.status IN ('open', 'offers', 'in_progress')")

        search = (filters.get("search") or "").strip()
        if search:
            conditions.append("(t.title ILIKE %s OR t.description ILIKE %s)")
            pattern = f"%{search}%"
            params.extend([pattern, pattern])

        where_clause = " WHERE " + " AND ".join(conditions)

        count_query = f"""
            SELECT COUNT(*) AS total
            FROM tasks t
            {where_clause}
        """
        items_query = f"""
            SELECT
                t.id,
                t.title,
                t.description,
                t.category,
                t.urgency,
                t.payment_type,
                t.price_amount,
                t.barter_description,
                t.visibility,
                t.status,
                t.offers_count,
                t.created_at,
                t.customer_id,
                u.full_name AS customer_full_name,
                u.rating_avg AS customer_rating_avg,
                u.completed_tasks_count AS customer_completed_tasks_count,
                uni.id AS university_id,
                uni.name AS university_name,
                d.id AS dormitory_id,
                d.name AS dormitory_name
            FROM tasks t
            JOIN users u ON u.id = t.customer_id
            JOIN universities uni ON uni.id = t.university_id
            JOIN dormitories d ON d.id = t.dormitory_id
            {where_clause}
            ORDER BY t.created_at DESC, t.id DESC
            LIMIT %s OFFSET %s
        """

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(count_query, params)
                total = cursor.fetchone()["total"]

                cursor.execute(items_query, [*params, limit, offset])
                rows = list(cursor.fetchall())

        return {
            "items": [self._serialize_task_summary(row) for row in rows],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def get_task_detail(
        self,
        task_id: int,
        *,
        current_user_id: int,
        current_university_id: int,
        current_dormitory_id: int | None,
    ) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        t.id,
                        t.title,
                        t.description,
                        t.category,
                        t.urgency,
                        t.payment_type,
                        t.price_amount,
                        t.barter_description,
                        t.visibility,
                        t.status,
                        t.offers_count,
                        t.created_at,
                        t.updated_at,
                        t.published_at,
                        t.starts_at,
                        t.completed_at,
                        t.cancelled_at,
                        t.cancellation_reason,
                        t.customer_id,
                        u.full_name AS customer_full_name,
                        u.rating_avg AS customer_rating_avg,
                        u.completed_tasks_count AS customer_completed_tasks_count,
                        uni.id AS university_id,
                        uni.name AS university_name,
                        d.id AS dormitory_id,
                        d.name AS dormitory_name,
                        chat.id AS chat_id,
                        ao.id AS accepted_offer_id,
                        ao.performer_id AS accepted_offer_performer_id,
                        ao.message AS accepted_offer_message,
                        ao.price_amount AS accepted_offer_price_amount,
                        ao.payment_type AS accepted_offer_payment_type,
                        ao.barter_description AS accepted_offer_barter_description,
                        ao.status AS accepted_offer_status,
                        performer.full_name AS accepted_offer_performer_full_name
                    FROM tasks t
                    JOIN users u ON u.id = t.customer_id
                    JOIN universities uni ON uni.id = t.university_id
                    JOIN dormitories d ON d.id = t.dormitory_id
                    LEFT JOIN task_chats chat ON chat.task_id = t.id
                    LEFT JOIN task_offers ao ON ao.id = t.accepted_offer_id
                    LEFT JOIN users performer ON performer.id = ao.performer_id
                    WHERE t.id = %s
                      AND t.university_id = %s
                    """,
                    (task_id, current_university_id),
                )
                row = cursor.fetchone()

                if row is None:
                    raise DomainValidationError("Задача не найдена")

                cursor.execute(
                    """
                    SELECT status
                    FROM task_offers
                    WHERE task_id = %s
                      AND performer_id = %s
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (task_id, current_user_id),
                )
                own_offer = cursor.fetchone()
                cursor.execute(
                    """
                    SELECT
                        confirmation.status,
                        confirmation.customer_confirmed_at,
                        confirmation.performer_confirmed_at,
                        assignment.customer_id,
                        assignment.performer_id
                    FROM task_assignments assignment
                    LEFT JOIN task_completion_confirmations confirmation
                        ON confirmation.task_assignment_id = assignment.id
                    WHERE assignment.task_id = %s
                    ORDER BY assignment.id DESC
                    LIMIT 1
                    """,
                    (task_id,),
                )
                completion_confirmation = cursor.fetchone()
                review_summary = self._build_task_review_summary(cursor, task_id, current_user_id=current_user_id)

        task = self._serialize_task_summary(row)
        task["chat_id"] = row["chat_id"]
        task["can_choose_performer"] = row["customer_id"] == current_user_id and row["status"] == "offers"
        task["can_respond"] = (
            row["customer_id"] != current_user_id
            and row["status"] in ("open", "offers")
            and (own_offer is None or own_offer["status"] in ("rejected", "withdrawn"))
        )
        task["accepted_offer"] = None
        task["completion_confirmation_status"] = (
            completion_confirmation["status"]
            if completion_confirmation is not None
            else None
        )
        task["completion_confirmed_by_me"] = bool(
            completion_confirmation is not None
            and (
                (
                    completion_confirmation["customer_id"] == current_user_id
                    and completion_confirmation["customer_confirmed_at"] is not None
                )
                or (
                    completion_confirmation["performer_id"] == current_user_id
                    and completion_confirmation["performer_confirmed_at"] is not None
                )
            )
        )
        task["review_summary"] = review_summary

        if row["accepted_offer_id"] is not None:
            task["accepted_offer"] = {
                "id": row["accepted_offer_id"],
                "task_id": task_id,
                "message": row["accepted_offer_message"],
                "price_amount": row["accepted_offer_price_amount"],
                "payment_type": row["accepted_offer_payment_type"],
                "barter_description": row["accepted_offer_barter_description"],
                "status": row["accepted_offer_status"],
                "created_at": row["updated_at"],
                "performer": {
                    "id": row["accepted_offer_performer_id"],
                    "full_name": row["accepted_offer_performer_full_name"],
                },
            }

        return task

    def create_task(
        self,
        *,
        customer_id: int,
        university_id: int,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
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
                        visibility,
                        currency
                    )
                    SELECT
                        %s,
                        %s,
                        d.id,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        'RUB'
                    FROM dormitories d
                    WHERE d.id = %s
                      AND d.university_id = %s
                    RETURNING id
                    """,
                    (
                        customer_id,
                        university_id,
                        payload["title"].strip(),
                        payload["description"].strip(),
                        payload["category"],
                        payload["urgency"],
                        payload["payment_type"],
                        payload.get("price_amount"),
                        payload.get("barter_description"),
                        payload["visibility"],
                        payload["dormitory_id"],
                        university_id,
                    ),
                )
                inserted = cursor.fetchone()
                if inserted is None:
                    raise DomainValidationError("Некорректное общежитие для новой задачи")

                self._refresh_user_metrics(cursor, [customer_id])

            connection.commit()

        return self.get_task_detail(
            inserted["id"],
            current_user_id=customer_id,
            current_university_id=university_id,
            current_dormitory_id=payload["dormitory_id"],
        )

    def cancel_task(self, task_id: int, *, current_user_id: int, reason: str) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                task = self._get_task_for_update(cursor, task_id)
                if task["customer_id"] != current_user_id:
                    raise ForbiddenError("Только заказчик может отменить задачу")
                if task["status"] in ("completed", "cancelled"):
                    raise DomainValidationError("Эту задачу уже нельзя отменить")

                cursor.execute(
                    """
                    UPDATE tasks
                    SET
                        status = 'cancelled',
                        cancelled_at = CURRENT_TIMESTAMP,
                        cancellation_reason = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (reason.strip(), task_id),
                )
                cursor.execute(
                    """
                    UPDATE task_assignments
                    SET
                        status = 'cancelled',
                        cancelled_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE task_id = %s
                    """,
                    (task_id,),
                )

            connection.commit()

        return {"status": "cancelled"}

    def list_user_tasks(
        self,
        user_id: int,
        *,
        role: str,
        status: str,
        current_university_id: int,
    ) -> list[dict[str, Any]]:
        if role not in ("customer", "performer"):
            raise DomainValidationError("role must be customer or performer")
        if status not in ("active", "completed", "cancelled"):
            raise DomainValidationError("status must be active, completed or cancelled")

        join_clause = ""
        owner_condition = "t.customer_id = %s"
        if role == "performer":
            join_clause = "JOIN task_assignments a_role ON a_role.task_id = t.id"
            owner_condition = "a_role.performer_id = %s"

        if status == "active":
            status_condition = "t.status IN ('open', 'offers', 'in_progress')"
        elif status == "completed":
            status_condition = "t.status = 'completed'"
        else:
            status_condition = "t.status = 'cancelled'"

        query = f"""
            SELECT
                t.id,
                t.title,
                t.description,
                t.category,
                t.urgency,
                t.payment_type,
                t.price_amount,
                t.status,
                t.offers_count,
                t.created_at,
                t.completed_at,
                t.cancelled_at,
                d.id AS dormitory_id,
                d.name AS dormitory_name,
                customer.id AS customer_id,
                customer.full_name AS customer_full_name,
                performer.id AS performer_id,
                performer.full_name AS performer_full_name
            FROM tasks t
            {join_clause}
            LEFT JOIN task_assignments assignment ON assignment.task_id = t.id
            LEFT JOIN users customer ON customer.id = t.customer_id
            LEFT JOIN users performer ON performer.id = assignment.performer_id
            LEFT JOIN dormitories d ON d.id = t.dormitory_id
            WHERE {owner_condition}
              AND t.university_id = %s
              AND {status_condition}
            ORDER BY COALESCE(t.completed_at, t.cancelled_at, t.created_at) DESC, t.id DESC
        """

        with get_connection() as connection:
            with connection.cursor() as cursor:
                self._ensure_user_visible_in_university(
                    cursor,
                    user_id=user_id,
                    current_university_id=current_university_id,
                )
                cursor.execute(query, (user_id, current_university_id))
                rows = list(cursor.fetchall())
                items: list[dict[str, Any]] = []
                for row in rows:
                    item = {
                        "id": row["id"],
                        "title": row["title"],
                        "description": row["description"],
                        "category": row["category"],
                        "urgency": row["urgency"],
                        "payment_type": row["payment_type"],
                        "price_amount": row["price_amount"],
                        "status": row["status"],
                        "offers_count": row["offers_count"],
                        "created_at": row["created_at"],
                        "completed_at": row["completed_at"],
                        "cancelled_at": row["cancelled_at"],
                        "role": role,
                        "dormitory": None if row["dormitory_id"] is None else {
                            "id": row["dormitory_id"],
                            "name": row["dormitory_name"],
                        },
                        "customer": None if row["customer_id"] is None else {
                            "id": row["customer_id"],
                            "full_name": row["customer_full_name"],
                        },
                        "performer": None if row["performer_id"] is None else {
                            "id": row["performer_id"],
                            "full_name": row["performer_full_name"],
                        },
                    }

                    if row["status"] == "completed":
                        item["review_summary"] = self._build_task_review_summary(
                            cursor,
                            row["id"],
                            current_user_id=user_id,
                        )

                    items.append(item)

        return items

    def list_task_offers(self, task_id: int, *, university_id: int) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id
                    FROM tasks
                    WHERE id = %s
                      AND university_id = %s
                    """,
                    (task_id, university_id),
                )
                if cursor.fetchone() is None:
                    raise DomainValidationError("Задача не найдена")

                cursor.execute(
                    """
                    SELECT
                        o.id,
                        o.task_id,
                        o.performer_id,
                        o.message,
                        o.price_amount,
                        o.payment_type,
                        o.barter_description,
                        o.status,
                        o.created_at,
                        u.full_name AS performer_full_name,
                        u.rating_avg AS performer_rating_avg,
                        u.completed_tasks_count AS performer_completed_tasks_count
                    FROM task_offers o
                    JOIN users u ON u.id = o.performer_id
                    WHERE o.task_id = %s
                    ORDER BY o.created_at DESC, o.id DESC
                    """,
                    (task_id,),
                )
                rows = list(cursor.fetchall())

        return [self._serialize_offer(row) for row in rows]

    def create_offer(
        self,
        task_id: int,
        *,
        performer_id: int,
        performer_university_id: int,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                task = self._get_task_for_update(cursor, task_id)
                if task["university_id"] != performer_university_id:
                    raise ForbiddenError("Нельзя откликаться на задачу другого университета")
                if task["customer_id"] == performer_id:
                    raise DomainValidationError("Нельзя откликаться на собственную задачу")
                if task["status"] not in ("open", "offers"):
                    raise DomainValidationError("Отклики доступны только для активных задач")

                cursor.execute(
                    """
                    SELECT id
                    FROM task_offers
                    WHERE task_id = %s
                      AND performer_id = %s
                      AND status IN ('pending', 'accepted')
                    """,
                    (task_id, performer_id),
                )
                if cursor.fetchone() is not None:
                    raise DomainValidationError("У вас уже есть активный отклик на эту задачу")

                payment_type, price_amount, barter_description = self._normalize_offer_terms(
                    task,
                    payload["payment_type"],
                    payload.get("price_amount"),
                    payload.get("barter_description"),
                )

                cursor.execute(
                    """
                    INSERT INTO task_offers (
                        task_id,
                        performer_id,
                        message,
                        price_amount,
                        payment_type,
                        barter_description
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        task_id,
                        performer_id,
                        payload["message"].strip(),
                        price_amount,
                        payment_type,
                        barter_description,
                    ),
                )
                offer_id = cursor.fetchone()["id"]

                self._sync_task_offer_state(cursor, task_id)
                self._insert_notification(
                    cursor,
                    user_id=task["customer_id"],
                    notification_type="offer_received",
                    title="Новый отклик на задачу",
                    body="Исполнитель оставил новое предложение по вашей задаче.",
                    entity_type="task",
                    entity_id=task_id,
                    payload={"task_id": task_id, "offer_id": offer_id},
                )

                cursor.execute(
                    """
                    SELECT
                        o.id,
                        o.task_id,
                        o.performer_id,
                        o.message,
                        o.price_amount,
                        o.payment_type,
                        o.barter_description,
                        o.status,
                        o.created_at,
                        u.full_name AS performer_full_name,
                        u.rating_avg AS performer_rating_avg,
                        u.completed_tasks_count AS performer_completed_tasks_count
                    FROM task_offers o
                    JOIN users u ON u.id = o.performer_id
                    WHERE o.id = %s
                    """,
                    (offer_id,),
                )
                row = cursor.fetchone()
            connection.commit()

        return self._serialize_offer(row)

    def update_offer(self, offer_id: int, *, performer_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        o.id,
                        o.task_id,
                        o.performer_id,
                        o.status,
                        t.payment_type AS task_payment_type,
                        t.price_amount AS task_price_amount,
                        t.barter_description AS task_barter_description
                    FROM task_offers o
                    JOIN tasks t ON t.id = o.task_id
                    WHERE o.id = %s
                    FOR UPDATE
                    """,
                    (offer_id,),
                )
                offer = cursor.fetchone()
                if offer is None:
                    raise DomainValidationError("Отклик не найден")
                if offer["performer_id"] != performer_id:
                    raise ForbiddenError("Можно редактировать только собственный отклик")
                if offer["status"] != "pending":
                    raise DomainValidationError("Редактировать можно только ожидающий отклик")

                task_terms = {
                    "payment_type": offer["task_payment_type"],
                    "price_amount": offer["task_price_amount"],
                    "barter_description": offer["task_barter_description"],
                }
                payment_type, price_amount, barter_description = self._normalize_offer_terms(
                    task_terms,
                    payload["payment_type"],
                    payload.get("price_amount"),
                    payload.get("barter_description"),
                )

                cursor.execute(
                    """
                    UPDATE task_offers
                    SET
                        message = %s,
                        payment_type = %s,
                        price_amount = %s,
                        barter_description = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (
                        payload["message"].strip(),
                        payment_type,
                        price_amount,
                        barter_description,
                        offer_id,
                    ),
                )
                cursor.execute(
                    """
                    SELECT
                        o.id,
                        o.task_id,
                        o.performer_id,
                        o.message,
                        o.price_amount,
                        o.payment_type,
                        o.barter_description,
                        o.status,
                        o.created_at,
                        u.full_name AS performer_full_name,
                        u.rating_avg AS performer_rating_avg,
                        u.completed_tasks_count AS performer_completed_tasks_count
                    FROM task_offers o
                    JOIN users u ON u.id = o.performer_id
                    WHERE o.id = %s
                    """,
                    (offer_id,),
                )
                row = cursor.fetchone()
            connection.commit()

        return self._serialize_offer(row)

    def withdraw_offer(self, offer_id: int, *, performer_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, task_id, performer_id, status
                    FROM task_offers
                    WHERE id = %s
                    FOR UPDATE
                    """,
                    (offer_id,),
                )
                offer = cursor.fetchone()
                if offer is None:
                    raise DomainValidationError("Отклик не найден")
                if offer["performer_id"] != performer_id:
                    raise ForbiddenError("Можно отзывать только собственный отклик")
                if offer["status"] != "pending":
                    raise DomainValidationError("Можно отозвать только ожидающий отклик")

                cursor.execute(
                    """
                    UPDATE task_offers
                    SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (offer_id,),
                )
                self._sync_task_offer_state(cursor, offer["task_id"])
            connection.commit()

        return {"status": "withdrawn"}

    def accept_offer(self, offer_id: int, *, customer_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        o.id,
                        o.task_id,
                        o.performer_id,
                        o.message,
                        o.price_amount,
                        o.payment_type,
                        o.barter_description,
                        o.status,
                        t.customer_id,
                        t.status AS task_status,
                        t.payment_type AS task_payment_type,
                        t.price_amount AS task_price_amount,
                        t.barter_description AS task_barter_description
                    FROM task_offers o
                    JOIN tasks t ON t.id = o.task_id
                    WHERE o.id = %s
                    FOR UPDATE
                    """,
                    (offer_id,),
                )
                offer = cursor.fetchone()
                if offer is None:
                    raise DomainValidationError("Отклик не найден")
                if offer["customer_id"] != customer_id:
                    raise ForbiddenError("Только заказчик может выбрать исполнителя")
                if offer["status"] != "pending":
                    raise DomainValidationError("Можно выбрать только ожидающий отклик")
                if offer["task_status"] not in ("open", "offers"):
                    raise DomainValidationError("По этой задаче уже нельзя выбрать исполнителя")

                agreed_payment_type = offer["payment_type"]
                agreed_price_amount = offer["price_amount"]
                agreed_barter_description = offer["barter_description"]
                if agreed_payment_type == "negotiable":
                    agreed_payment_type = offer["task_payment_type"]
                    agreed_price_amount = offer["task_price_amount"]
                    agreed_barter_description = offer["task_barter_description"]

                if agreed_payment_type == "negotiable":
                    raise DomainValidationError("Перед выбором исполнителя зафиксируйте цену или barter условия")

                cursor.execute(
                    """
                    UPDATE task_offers
                    SET
                        status = CASE WHEN id = %s THEN 'accepted' ELSE 'rejected' END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE task_id = %s
                      AND status = 'pending'
                    RETURNING id, performer_id, status
                    """,
                    (offer_id, offer["task_id"]),
                )
                changed_offers = list(cursor.fetchall())

                cursor.execute(
                    """
                    UPDATE tasks
                    SET
                        status = 'in_progress',
                        accepted_offer_id = %s,
                        offers_count = 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (offer_id, offer["task_id"]),
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
                        status,
                        started_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'in_progress', CURRENT_TIMESTAMP)
                    RETURNING id
                    """,
                    (
                        offer["task_id"],
                        offer_id,
                        customer_id,
                        offer["performer_id"],
                        agreed_price_amount,
                        agreed_payment_type,
                        agreed_barter_description,
                    ),
                )
                assignment_id = cursor.fetchone()["id"]

                cursor.execute(
                    """
                    INSERT INTO task_completion_confirmations (
                        task_assignment_id,
                        status
                    )
                    VALUES (%s, 'pending')
                    """,
                    (assignment_id,),
                )

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
                    (offer["task_id"], customer_id, offer["performer_id"]),
                )
                chat_id = cursor.fetchone()["id"]

                for changed_offer in changed_offers:
                    if changed_offer["status"] == "accepted":
                        self._insert_notification(
                            cursor,
                            user_id=changed_offer["performer_id"],
                            notification_type="offer_accepted",
                            title="Ваш отклик принят",
                            body="Заказчик выбрал вас исполнителем по задаче.",
                            entity_type="task",
                            entity_id=offer["task_id"],
                            payload={"task_id": offer["task_id"], "chat_id": chat_id},
                        )
                    else:
                        self._insert_notification(
                            cursor,
                            user_id=changed_offer["performer_id"],
                            notification_type="offer_rejected",
                            title="Отклик отклонён",
                            body="Заказчик выбрал другого исполнителя по задаче.",
                            entity_type="task",
                            entity_id=offer["task_id"],
                            payload={"task_id": offer["task_id"]},
                        )

            connection.commit()

        return {
            "status": "accepted",
            "task_id": offer["task_id"],
            "assignment_id": assignment_id,
            "chat_id": chat_id,
        }

    def reject_offer(self, offer_id: int, *, customer_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT o.id, o.task_id, o.performer_id, o.status, t.customer_id
                    FROM task_offers o
                    JOIN tasks t ON t.id = o.task_id
                    WHERE o.id = %s
                    FOR UPDATE
                    """,
                    (offer_id,),
                )
                offer = cursor.fetchone()
                if offer is None:
                    raise DomainValidationError("Отклик не найден")
                if offer["customer_id"] != customer_id:
                    raise ForbiddenError("Только заказчик может отклонить отклик")
                if offer["status"] != "pending":
                    raise DomainValidationError("Можно отклонить только ожидающий отклик")

                cursor.execute(
                    """
                    UPDATE task_offers
                    SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (offer_id,),
                )
                self._sync_task_offer_state(cursor, offer["task_id"])
                self._insert_notification(
                    cursor,
                    user_id=offer["performer_id"],
                    notification_type="offer_rejected",
                    title="Отклик отклонён",
                    body="Заказчик отклонил ваш отклик по задаче.",
                    entity_type="task",
                    entity_id=offer["task_id"],
                    payload={"task_id": offer["task_id"]},
                )
            connection.commit()

        return {"status": "rejected"}

    def list_counter_offers(self, offer_id: int, *, user_id: int) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                self._ensure_counter_offer_access(cursor, offer_id, user_id)
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
                    ORDER BY created_at ASC, id ASC
                    """,
                    (offer_id,),
                )
                rows = list(cursor.fetchall())

        return rows

    def create_counter_offer(
        self,
        offer_id: int,
        *,
        author_user_id: int,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                offer = self._ensure_counter_offer_access(cursor, offer_id, author_user_id, for_update=True)
                if offer["status"] != "pending":
                    raise DomainValidationError("Переговоры доступны только для ожидающего отклика")

                cursor.execute(
                    """
                    SELECT id, author_user_id, status
                    FROM offer_counter_offers
                    WHERE offer_id = %s
                    ORDER BY created_at DESC, id DESC
                    LIMIT 1
                    """,
                    (offer_id,),
                )
                latest_counter_offer = cursor.fetchone()

                if latest_counter_offer is None and author_user_id == offer["performer_id"]:
                    raise DomainValidationError("Сначала дождитесь ответа заказчика на ваш отклик")

                if latest_counter_offer is not None and latest_counter_offer["author_user_id"] == author_user_id:
                    raise DomainValidationError("Вы уже обновили условия. Дождитесь ответа второй стороны")

                cursor.execute(
                    """
                    UPDATE offer_counter_offers
                    SET status = 'superseded', updated_at = CURRENT_TIMESTAMP
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
                        barter_description
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        offer_id,
                        author_user_id,
                        (payload.get("message") or "").strip() or None,
                        payload.get("price_amount"),
                        payload["payment_type"],
                        payload.get("barter_description"),
                    ),
                )
                counter_offer_id = cursor.fetchone()["id"]

                recipient_user_id = (
                    offer["customer_id"]
                    if author_user_id == offer["performer_id"]
                    else offer["performer_id"]
                )
                self._insert_notification(
                    cursor,
                    user_id=recipient_user_id,
                    notification_type="counter_offer_received",
                    title="Получено контрпредложение",
                    body="Условия по отклику были обновлены.",
                    entity_type="task",
                    entity_id=offer["task_id"],
                    payload={"task_id": offer["task_id"], "offer_id": offer_id},
                )

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
                row = cursor.fetchone()
            connection.commit()

        return row

    def accept_counter_offer(self, counter_offer_id: int, *, user_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        c.id,
                        c.offer_id,
                        c.author_user_id,
                        c.message,
                        c.price_amount,
                        c.payment_type,
                        c.barter_description,
                        c.status,
                        o.task_id,
                        o.performer_id,
                        t.customer_id
                    FROM offer_counter_offers c
                    JOIN task_offers o ON o.id = c.offer_id
                    JOIN tasks t ON t.id = o.task_id
                    WHERE c.id = %s
                    FOR UPDATE
                    """,
                    (counter_offer_id,),
                )
                counter_offer = cursor.fetchone()
                if counter_offer is None:
                    raise DomainValidationError("Контрпредложение не найдено")
                if counter_offer["status"] != "pending":
                    raise DomainValidationError("Можно принять только ожидающее контрпредложение")
                if counter_offer["author_user_id"] == user_id:
                    raise DomainValidationError("Нельзя принять собственное контрпредложение")
                if user_id not in (counter_offer["customer_id"], counter_offer["performer_id"]):
                    raise ForbiddenError("У вас нет доступа к этому контрпредложению")

                cursor.execute(
                    """
                    UPDATE offer_counter_offers
                    SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (counter_offer_id,),
                )
                cursor.execute(
                    """
                    UPDATE offer_counter_offers
                    SET status = 'superseded', updated_at = CURRENT_TIMESTAMP
                    WHERE offer_id = %s
                      AND id <> %s
                      AND status = 'pending'
                    """,
                    (counter_offer["offer_id"], counter_offer_id),
                )
                cursor.execute(
                    """
                    UPDATE task_offers
                    SET
                        message = COALESCE(%s, message),
                        payment_type = %s,
                        price_amount = %s,
                        barter_description = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (
                        counter_offer["message"],
                        counter_offer["payment_type"],
                        counter_offer["price_amount"],
                        counter_offer["barter_description"],
                        counter_offer["offer_id"],
                    ),
                )

                recipient_user_id = counter_offer["author_user_id"]
                self._insert_notification(
                    cursor,
                    user_id=recipient_user_id,
                    notification_type="counter_offer_accepted",
                    title="Контрпредложение принято",
                    body="Собеседник принял ваши обновлённые условия.",
                    entity_type="task",
                    entity_id=counter_offer["task_id"],
                    payload={"task_id": counter_offer["task_id"], "offer_id": counter_offer["offer_id"]},
                )
            connection.commit()

        return {"status": "accepted"}

    def reject_counter_offer(self, counter_offer_id: int, *, user_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        c.id,
                        c.offer_id,
                        c.author_user_id,
                        c.status,
                        o.task_id,
                        o.performer_id,
                        t.customer_id
                    FROM offer_counter_offers c
                    JOIN task_offers o ON o.id = c.offer_id
                    JOIN tasks t ON t.id = o.task_id
                    WHERE c.id = %s
                    FOR UPDATE
                    """,
                    (counter_offer_id,),
                )
                counter_offer = cursor.fetchone()
                if counter_offer is None:
                    raise DomainValidationError("Контрпредложение не найдено")
                if counter_offer["status"] != "pending":
                    raise DomainValidationError("Можно отклонить только ожидающее контрпредложение")
                if counter_offer["author_user_id"] == user_id:
                    raise DomainValidationError("Нельзя отклонить собственное контрпредложение")
                if user_id not in (counter_offer["customer_id"], counter_offer["performer_id"]):
                    raise ForbiddenError("У вас нет доступа к этому контрпредложению")

                cursor.execute(
                    """
                    UPDATE offer_counter_offers
                    SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (counter_offer_id,),
                )

                self._insert_notification(
                    cursor,
                    user_id=counter_offer["author_user_id"],
                    notification_type="counter_offer_rejected",
                    title="Контрпредложение отклонено",
                    body="Собеседник отклонил ваши обновлённые условия.",
                    entity_type="task",
                    entity_id=counter_offer["task_id"],
                    payload={"task_id": counter_offer["task_id"], "offer_id": counter_offer["offer_id"]},
                )
            connection.commit()

        return {"status": "rejected"}

    def list_chats(self, user_id: int) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, task_id, customer_id, performer_id, created_at, updated_at
                    FROM task_chats
                    WHERE customer_id = %s OR performer_id = %s
                    ORDER BY updated_at DESC, id DESC
                    """,
                    (user_id, user_id),
                )
                return list(cursor.fetchall())

    def get_chat(self, chat_id: int, *, user_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, task_id, customer_id, performer_id, created_at, updated_at
                    FROM task_chats
                    WHERE id = %s
                      AND (customer_id = %s OR performer_id = %s)
                    """,
                    (chat_id, user_id, user_id),
                )
                row = cursor.fetchone()

        if row is None:
            raise DomainValidationError("Чат не найден")

        return row

    def list_chat_messages(
        self,
        chat_id: int,
        *,
        user_id: int,
        limit: int,
        before_message_id: int | None,
    ) -> dict[str, Any]:
        self.get_chat(chat_id, user_id=user_id)

        conditions = ["chat_id = %s"]
        params: list[Any] = [chat_id]
        if before_message_id is not None:
            conditions.append("id < %s")
            params.append(before_message_id)

        query = f"""
            SELECT id, chat_id, sender_id, message_type, body, created_at, read_at
            FROM chat_messages
            WHERE {" AND ".join(conditions)}
            ORDER BY id DESC
            LIMIT %s
        """

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, [*params, limit])
                rows = list(cursor.fetchall())

        return {
            "items": list(reversed(rows)),
            "limit": limit,
            "before_message_id": before_message_id,
        }

    def send_chat_message(self, chat_id: int, *, user_id: int, body: str) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                chat = self.get_chat(chat_id, user_id=user_id)
                recipient_user_id = (
                    chat["performer_id"]
                    if chat["customer_id"] == user_id
                    else chat["customer_id"]
                )

                cursor.execute(
                    """
                    INSERT INTO chat_messages (
                        chat_id,
                        sender_id,
                        message_type,
                        body
                    )
                    VALUES (%s, %s, 'text', %s)
                    RETURNING id, chat_id, sender_id, message_type, body, created_at, read_at
                    """,
                    (chat_id, user_id, body.strip()),
                )
                message = cursor.fetchone()

                cursor.execute(
                    """
                    UPDATE task_chats
                    SET updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (chat_id,),
                )
                self._insert_notification(
                    cursor,
                    user_id=recipient_user_id,
                    notification_type="chat_message_received",
                    title="Новое сообщение в чате",
                    body=body.strip()[:120],
                    entity_type="task",
                    entity_id=chat["task_id"],
                    payload={"task_id": chat["task_id"], "chat_id": chat_id},
                )
            connection.commit()

        return message

    def mark_chat_read(self, chat_id: int, *, user_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                self.get_chat(chat_id, user_id=user_id)
                cursor.execute(
                    """
                    UPDATE chat_messages
                    SET read_at = CURRENT_TIMESTAMP
                    WHERE chat_id = %s
                      AND sender_id <> %s
                      AND read_at IS NULL
                    """,
                    (chat_id, user_id),
                )
            connection.commit()

        return {"status": "read"}

    def confirm_task_completion(self, task_id: int, *, user_id: int) -> dict[str, Any]:
        status = self._complete_or_confirm_task(task_id, user_id=user_id)
        return {"status": status}

    def list_task_reviews(
        self,
        task_id: int,
        *,
        current_user_id: int,
        current_university_id: int,
        current_dormitory_id: int | None,
    ) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                self._ensure_task_visibility(
                    cursor,
                    task_id,
                    current_user_id=current_user_id,
                    current_university_id=current_university_id,
                    current_dormitory_id=current_dormitory_id,
                )
                rows = self._list_task_review_rows(cursor, task_id)

        return [self._serialize_task_review(row) for row in rows]

    def create_task_review(self, task_id: int, *, user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                assignment = self._get_assignment_context(cursor, task_id, for_update=True)
                if assignment is None:
                    raise DomainValidationError("Для задачи ещё нет подтверждённой сделки")
                if assignment["status"] != "completed":
                    raise DomainValidationError("Оставить отзыв можно только после завершения сделки")
                if user_id not in (assignment["customer_id"], assignment["performer_id"]):
                    raise ForbiddenError("Отзыв могут оставить только участники сделки")

                cursor.execute(
                    """
                    SELECT id
                    FROM reviews
                    WHERE task_assignment_id = %s
                      AND author_id = %s
                    """,
                    (assignment["id"], user_id),
                )
                if cursor.fetchone() is not None:
                    raise DomainValidationError("Вы уже оставили отзыв по этой сделке")

                target_user_id = (
                    assignment["performer_id"]
                    if user_id == assignment["customer_id"]
                    else assignment["customer_id"]
                )

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
                    RETURNING id
                    """,
                    (
                        task_id,
                        assignment["id"],
                        user_id,
                        target_user_id,
                        payload["rating"],
                        (payload.get("comment") or "").strip() or None,
                    ),
                )
                review_id = cursor.fetchone()["id"]

                self._insert_notification(
                    cursor,
                    user_id=target_user_id,
                    notification_type="review_received",
                    title="Получен отзыв по сделке",
                    body="Вторая сторона оставила отзыв о завершённой сделке.",
                    entity_type="task",
                    entity_id=task_id,
                    payload={"task_id": task_id, "review_id": review_id},
                )
                self._refresh_user_metrics(cursor, [target_user_id])

                cursor.execute(
                    """
                    SELECT
                        r.id,
                        r.task_id,
                        r.task_assignment_id,
                        r.author_id,
                        author.full_name AS author_full_name,
                        r.target_user_id,
                        target.full_name AS target_full_name,
                        r.rating,
                        r.comment,
                        r.is_visible,
                        r.moderation_status,
                        r.created_at,
                        r.updated_at,
                        CASE
                            WHEN assignment.customer_id = r.author_id THEN 'customer'
                            ELSE 'performer'
                        END AS author_role,
                        CASE
                            WHEN assignment.customer_id = r.target_user_id THEN 'customer'
                            ELSE 'performer'
                        END AS target_role
                    FROM reviews r
                    JOIN task_assignments assignment ON assignment.id = r.task_assignment_id
                    JOIN users author ON author.id = r.author_id
                    JOIN users target ON target.id = r.target_user_id
                    WHERE r.id = %s
                    """,
                    (review_id,),
                )
                row = cursor.fetchone()
            connection.commit()

        return self._serialize_task_review(row)

    def list_notifications(
        self,
        *,
        user_id: int,
        status: str,
        limit: int,
        offset: int,
    ) -> dict[str, Any]:
        conditions = ["user_id = %s"]
        params: list[Any] = [user_id]
        if status == "unread":
            conditions.append("is_read = FALSE")

        where_clause = " WHERE " + " AND ".join(conditions)

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
                unread_count = cursor.fetchone()["unread_count"]

                cursor.execute(
                    f"""
                    SELECT id, type, title, body, entity_type, entity_id, payload, is_read, created_at
                    FROM notifications
                    {where_clause}
                    ORDER BY created_at DESC, id DESC
                    LIMIT %s OFFSET %s
                    """,
                    [*params, limit, offset],
                )
                rows = list(cursor.fetchall())

        return {
            "items": [self._serialize_notification(row) for row in rows],
            "unread_count": unread_count,
            "limit": limit,
            "offset": offset,
        }

    def get_unread_notifications_count(self, user_id: int) -> dict[str, Any]:
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
                return cursor.fetchone()

    def mark_notification_read(self, *, user_id: int, notification_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE notifications
                    SET
                        is_read = TRUE,
                        read_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                      AND user_id = %s
                    """,
                    (notification_id, user_id),
                )
            connection.commit()

        return {"status": "read"}

    def mark_all_notifications_read(self, *, user_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE notifications
                    SET
                        is_read = TRUE,
                        read_at = CURRENT_TIMESTAMP
                    WHERE user_id = %s
                      AND is_read = FALSE
                    """,
                    (user_id,),
                )
            connection.commit()

        return {"status": "read"}

    def get_category_analytics(self, *, university_id: int, category: str) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        COUNT(*) AS completed_tasks_count,
                        COALESCE(
                            ROUND(AVG(a.agreed_price_amount) FILTER (WHERE a.agreed_price_amount IS NOT NULL)),
                            0
                        ) AS avg_price_amount,
                        COALESCE(
                            ROUND(
                                percentile_cont(0.5) WITHIN GROUP (ORDER BY a.agreed_price_amount)
                                FILTER (WHERE a.agreed_price_amount IS NOT NULL)
                            ),
                            0
                        ) AS median_price_amount,
                        COALESCE(MIN(a.agreed_price_amount), 0) AS min_price_amount,
                        COALESCE(MAX(a.agreed_price_amount), 0) AS max_price_amount,
                        COALESCE(
                            ROUND(
                                AVG(EXTRACT(EPOCH FROM (COALESCE(t.completed_at, a.completed_at) - t.published_at)) / 60)
                            ),
                            0
                        ) AS avg_completion_minutes
                    FROM tasks t
                    LEFT JOIN task_assignments a ON a.task_id = t.id
                    WHERE t.university_id = %s
                      AND t.category = %s
                      AND t.status = 'completed'
                    """,
                    (university_id, category),
                )
                metrics = cursor.fetchone()

                cursor.execute(
                    """
                    SELECT
                        CONCAT(bucket_start, '-', bucket_start + 499) AS range,
                        COUNT(*) AS count
                    FROM (
                        SELECT ((agreed_price_amount - 1) / 500) * 500 AS bucket_start
                        FROM task_assignments a
                        JOIN tasks t ON t.id = a.task_id
                        WHERE t.university_id = %s
                          AND t.category = %s
                          AND t.status = 'completed'
                          AND a.agreed_price_amount IS NOT NULL
                    ) histogram
                    GROUP BY bucket_start
                    ORDER BY bucket_start
                    """,
                    (university_id, category),
                )
                histogram = list(cursor.fetchall())

        return {
            "category": category,
            "completed_tasks_count": int(metrics["completed_tasks_count"] or 0),
            "avg_price_amount": int(metrics["avg_price_amount"] or 0),
            "median_price_amount": int(metrics["median_price_amount"] or 0),
            "min_price_amount": int(metrics["min_price_amount"] or 0),
            "max_price_amount": int(metrics["max_price_amount"] or 0),
            "avg_completion_minutes": int(metrics["avg_completion_minutes"] or 0),
            "price_histogram": [
                {"range": row["range"], "count": row["count"]}
                for row in histogram
            ],
        }

    def get_category_deals(self, *, university_id: int, category: str, limit: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        t.id AS task_id,
                        t.title,
                        COALESCE(a.agreed_price_amount, t.price_amount) AS price_amount,
                        COALESCE(t.completed_at, a.completed_at) AS completed_at
                    FROM tasks t
                    LEFT JOIN task_assignments a ON a.task_id = t.id
                    WHERE t.university_id = %s
                      AND t.category = %s
                      AND t.status = 'completed'
                      AND COALESCE(a.agreed_price_amount, t.price_amount) IS NOT NULL
                      AND COALESCE(t.completed_at, a.completed_at) IS NOT NULL
                    ORDER BY COALESCE(t.completed_at, a.completed_at) DESC, t.id DESC
                    LIMIT %s
                    """,
                    (university_id, category, limit),
                )
                rows = list(cursor.fetchall())

        return {
            "category": category,
            "points": [
                {
                    "task_id": int(row["task_id"]),
                    "title": row["title"],
                    "price_amount": int(row["price_amount"]),
                    "completed_at": row["completed_at"],
                }
                for row in rows
            ],
        }

    def _complete_or_confirm_task(self, task_id: int, *, user_id: int) -> str:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                assignment = self._get_assignment_for_task(cursor, task_id, for_update=True)
                if assignment is None:
                    raise DomainValidationError("Для задачи ещё нет активного исполнителя")
                if user_id not in (assignment["customer_id"], assignment["performer_id"]):
                    raise ForbiddenError("Только участники задачи могут подтвердить выполнение")

                cursor.execute(
                    """
                    SELECT
                        id,
                        customer_confirmed_at,
                        performer_confirmed_at,
                        status
                    FROM task_completion_confirmations
                    WHERE task_assignment_id = %s
                    FOR UPDATE
                    """,
                    (assignment["id"],),
                )
                confirmation = cursor.fetchone()
                if confirmation is None:
                    raise DomainValidationError("Не найдена запись подтверждения выполнения")
                if confirmation["status"] == "disputed":
                    raise DomainValidationError("По задаче открыт спор")
                if confirmation["status"] == "completed":
                    return "completed"

                customer_confirmed_at = confirmation["customer_confirmed_at"]
                performer_confirmed_at = confirmation["performer_confirmed_at"]

                if user_id == assignment["customer_id"] and customer_confirmed_at is None:
                    customer_confirmed_at = datetime.now(UTC)
                if user_id == assignment["performer_id"] and performer_confirmed_at is None:
                    performer_confirmed_at = datetime.now(UTC)

                if customer_confirmed_at and performer_confirmed_at:
                    next_status = "completed"
                elif customer_confirmed_at:
                    next_status = "customer_confirmed"
                else:
                    next_status = "performer_confirmed"

                cursor.execute(
                    """
                    UPDATE task_completion_confirmations
                    SET
                        customer_confirmed_at = %s,
                        performer_confirmed_at = %s,
                        status = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (
                        customer_confirmed_at,
                        performer_confirmed_at,
                        next_status,
                        confirmation["id"],
                    ),
                )

                recipient_user_id = (
                    assignment["performer_id"]
                    if assignment["customer_id"] == user_id
                    else assignment["customer_id"]
                )

                if next_status == "completed":
                    cursor.execute(
                        """
                        UPDATE task_assignments
                        SET
                            status = 'completed',
                            completed_at = CURRENT_TIMESTAMP,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                        """,
                        (assignment["id"],),
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
                    self._insert_notification(
                        cursor,
                        user_id=assignment["customer_id"],
                        notification_type="task_completed_confirmed",
                        title="Задача завершена",
                        body="Выполнение подтверждено обеими сторонами. Теперь можно оставить отзыв.",
                        entity_type="task",
                        entity_id=task_id,
                        payload={"task_id": task_id},
                    )
                    self._insert_notification(
                        cursor,
                        user_id=assignment["performer_id"],
                        notification_type="task_completed_confirmed",
                        title="Задача завершена",
                        body="Выполнение подтверждено обеими сторонами. Теперь можно оставить отзыв.",
                        entity_type="task",
                        entity_id=task_id,
                        payload={"task_id": task_id},
                    )
                    self._refresh_user_metrics(
                        cursor,
                        [assignment["customer_id"], assignment["performer_id"]],
                    )
                else:
                    self._insert_notification(
                        cursor,
                        user_id=recipient_user_id,
                        notification_type="task_completed_requested",
                        title="Вторая сторона подтвердила выполнение",
                        body="Если результат вас устраивает, подтвердите сделку со своей стороны.",
                        entity_type="task",
                        entity_id=task_id,
                        payload={"task_id": task_id},
                    )

            connection.commit()

        return next_status

    def _get_assignment_for_task(
        self,
        cursor,
        task_id: int,
        *,
        for_update: bool = False,
    ) -> dict[str, Any] | None:
        query = """
            SELECT
                id,
                task_id,
                customer_id,
                performer_id,
                status
            FROM task_assignments
            WHERE task_id = %s
        """
        if for_update:
            query += " FOR UPDATE"
        cursor.execute(query, (task_id,))
        return cursor.fetchone()

    def _get_task_for_update(self, cursor, task_id: int) -> dict[str, Any]:
        cursor.execute(
            """
            SELECT
                id,
                customer_id,
                university_id,
                dormitory_id,
                payment_type,
                price_amount,
                barter_description,
                status,
                offers_count
            FROM tasks
            WHERE id = %s
            FOR UPDATE
            """,
            (task_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise DomainValidationError("Задача не найдена")
        return row

    def _ensure_task_visibility(
        self,
        cursor,
        task_id: int,
        *,
        current_user_id: int,
        current_university_id: int,
        current_dormitory_id: int | None,
    ) -> dict[str, Any]:
        cursor.execute(
            """
            SELECT
                t.id,
                t.visibility,
                t.customer_id,
                t.dormitory_id,
                ao.performer_id AS accepted_offer_performer_id
            FROM tasks t
            LEFT JOIN task_offers ao ON ao.id = t.accepted_offer_id
            WHERE t.id = %s
              AND t.university_id = %s
            """,
            (task_id, current_university_id),
        )
        task = cursor.fetchone()
        if task is None:
            raise DomainValidationError("Задача не найдена")

        return task

    def _get_assignment_context(
        self,
        cursor,
        task_id: int,
        *,
        for_update: bool = False,
    ) -> dict[str, Any] | None:
        query = """
            SELECT
                a.id,
                a.task_id,
                a.customer_id,
                customer.full_name AS customer_full_name,
                a.performer_id,
                performer.full_name AS performer_full_name,
                a.status
            FROM task_assignments a
            JOIN users customer ON customer.id = a.customer_id
            JOIN users performer ON performer.id = a.performer_id
            WHERE a.task_id = %s
        """
        if for_update:
            query += " FOR UPDATE"
        cursor.execute(query, (task_id,))
        return cursor.fetchone()

    def _list_task_review_rows(self, cursor, task_id: int) -> list[dict[str, Any]]:
        cursor.execute(
            """
            SELECT
                r.id,
                r.task_id,
                r.task_assignment_id,
                r.author_id,
                author.full_name AS author_full_name,
                r.target_user_id,
                target.full_name AS target_full_name,
                r.rating,
                r.comment,
                r.is_visible,
                r.moderation_status,
                r.created_at,
                r.updated_at,
                CASE
                    WHEN assignment.customer_id = r.author_id THEN 'customer'
                    ELSE 'performer'
                END AS author_role,
                CASE
                    WHEN assignment.customer_id = r.target_user_id THEN 'customer'
                    ELSE 'performer'
                END AS target_role
            FROM reviews r
            JOIN task_assignments assignment ON assignment.id = r.task_assignment_id
            JOIN users author ON author.id = r.author_id
            JOIN users target ON target.id = r.target_user_id
            WHERE r.task_id = %s
            ORDER BY r.created_at ASC, r.id ASC
            """,
            (task_id,),
        )
        return list(cursor.fetchall())

    def _build_task_review_summary(
        self,
        cursor,
        task_id: int,
        *,
        current_user_id: int,
    ) -> dict[str, Any] | None:
        assignment = self._get_assignment_context(cursor, task_id)
        if assignment is None:
            return None

        reviews = [self._serialize_task_review(row) for row in self._list_task_review_rows(cursor, task_id)]
        current_role: str | None = None
        counterpart_user: dict[str, Any] | None = None

        if current_user_id == assignment["customer_id"]:
            current_role = "customer"
            counterpart_user = {
                "id": assignment["performer_id"],
                "full_name": assignment["performer_full_name"],
                "role": "performer",
            }
        elif current_user_id == assignment["performer_id"]:
            current_role = "performer"
            counterpart_user = {
                "id": assignment["customer_id"],
                "full_name": assignment["customer_full_name"],
                "role": "customer",
            }

        my_review = next((review for review in reviews if review["author"]["id"] == current_user_id), None)
        counterpart_review = None
        if current_role is not None:
            counterpart_review = next((review for review in reviews if review["author"]["id"] != current_user_id), None)

        customer_review = next((review for review in reviews if review["target"]["role"] == "customer"), None)
        performer_review = next((review for review in reviews if review["target"]["role"] == "performer"), None)
        is_completed = assignment["status"] == "completed"

        return {
            "assignment_id": assignment["id"],
            "status": assignment["status"],
            "my_role": current_role,
            "counterpart_user": counterpart_user,
            "can_leave_review": bool(is_completed and current_role is not None and my_review is None),
            "pending_by_me": bool(is_completed and current_role is not None and my_review is None),
            "pending_by_counterpart": bool(is_completed and current_role is not None and counterpart_review is None),
            "my_review": my_review,
            "counterpart_review": counterpart_review,
            "customer_review": customer_review,
            "performer_review": performer_review,
        }

    def _ensure_counter_offer_access(self, cursor, offer_id: int, user_id: int, *, for_update: bool = False) -> dict[str, Any]:
        query = """
            SELECT
                o.id,
                o.task_id,
                o.performer_id,
                o.status,
                t.customer_id
            FROM task_offers o
            JOIN tasks t ON t.id = o.task_id
            WHERE o.id = %s
        """
        if for_update:
            query += " FOR UPDATE"
        cursor.execute(query, (offer_id,))
        offer = cursor.fetchone()
        if offer is None:
            raise DomainValidationError("Отклик не найден")
        if user_id not in (offer["customer_id"], offer["performer_id"]):
            raise ForbiddenError("У вас нет доступа к переговорам по этому отклику")
        return offer

    def _normalize_offer_terms(
        self,
        task: dict[str, Any],
        payment_type: str,
        price_amount: int | None,
        barter_description: str | None,
    ) -> tuple[str, int | None, str | None]:
        normalized_payment_type = payment_type
        normalized_price_amount = price_amount
        normalized_barter_description = barter_description

        if normalized_payment_type == "fixed_price":
            if normalized_price_amount is None or normalized_price_amount <= 0:
                raise DomainValidationError("Для fixed_price требуется положительная цена")
            normalized_barter_description = None
        elif normalized_payment_type == "barter":
            if normalized_barter_description is None or not normalized_barter_description.strip():
                raise DomainValidationError("Для barter требуется описание обмена")
            normalized_price_amount = None
            normalized_barter_description = normalized_barter_description.strip()
        elif normalized_payment_type == "negotiable":
            normalized_price_amount = None
            normalized_barter_description = None
        else:
            raise DomainValidationError("Некорректный тип оплаты")

        return normalized_payment_type, normalized_price_amount, normalized_barter_description

    def _serialize_me(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "email": row["email"],
            "full_name": row["full_name"],
            "role": row["role"],
            "room_label": row["room_label"],
            "bio": row["bio"],
            "university": {
                "id": row["university_id"],
                "name": row["university_name"],
            },
            "dormitory": None if row["dormitory_id"] is None else {
                "id": row["dormitory_id"],
                "name": row["dormitory_name"],
            },
            "profile_completed": bool(row["full_name"] and row["dormitory_id"]),
        }

    def _serialize_task_summary(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "title": row["title"],
            "description": row["description"],
            "category": row["category"],
            "urgency": row["urgency"],
            "payment_type": row["payment_type"],
            "price_amount": row["price_amount"],
            "barter_description": row.get("barter_description"),
            "status": row["status"],
            "visibility": row["visibility"],
            "offers_count": row["offers_count"],
            "created_at": row["created_at"],
            "published_at": row.get("published_at", row["created_at"]),
            "starts_at": row.get("starts_at"),
            "completed_at": row.get("completed_at"),
            "cancelled_at": row.get("cancelled_at"),
            "cancellation_reason": row.get("cancellation_reason"),
            "customer": {
                "id": row["customer_id"],
                "full_name": row["customer_full_name"],
                "rating_avg": float(row["customer_rating_avg"] or 0),
                "completed_tasks_count": row.get("customer_completed_tasks_count", 0),
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

    def _serialize_offer(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "task_id": row["task_id"],
            "message": row["message"],
            "price_amount": row["price_amount"],
            "payment_type": row["payment_type"],
            "barter_description": row["barter_description"],
            "status": row["status"],
            "created_at": row["created_at"],
            "performer": {
                "id": row["performer_id"],
                "full_name": row["performer_full_name"],
                "rating_avg": float(row["performer_rating_avg"] or 0),
                "completed_tasks_count": row["performer_completed_tasks_count"],
            },
        }

    def _serialize_task_review(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "task_id": row["task_id"],
            "task_assignment_id": row["task_assignment_id"],
            "rating": int(row["rating"]),
            "comment": row["comment"],
            "is_visible": bool(row["is_visible"]),
            "moderation_status": row["moderation_status"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "author": {
                "id": row["author_id"],
                "full_name": row["author_full_name"],
                "role": row["author_role"],
            },
            "target": {
                "id": row["target_user_id"],
                "full_name": row["target_full_name"],
                "role": row["target_role"],
            },
        }

    def _serialize_notification(self, row: dict[str, Any]) -> dict[str, Any]:
        payload = row["payload"]
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except ValueError:
                payload = None

        return {
            "id": row["id"],
            "type": row["type"],
            "title": row["title"],
            "body": row["body"],
            "entity_type": row["entity_type"],
            "entity_id": row["entity_id"],
            "payload": payload,
            "is_read": row["is_read"],
            "created_at": row["created_at"],
        }

    def _insert_notification(
        self,
        cursor,
        *,
        user_id: int,
        notification_type: str,
        title: str,
        body: str,
        entity_type: str | None,
        entity_id: int | None,
        payload: dict[str, Any] | None,
    ) -> None:
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

    def _sync_task_offer_state(self, cursor, task_id: int) -> None:
        cursor.execute(
            """
            SELECT COUNT(*) AS active_offers
            FROM task_offers
            WHERE task_id = %s
              AND status IN ('pending', 'accepted')
            """,
            (task_id,),
        )
        active_offers = cursor.fetchone()["active_offers"]

        cursor.execute(
            """
            SELECT accepted_offer_id, status
            FROM tasks
            WHERE id = %s
            """,
            (task_id,),
        )
        task = cursor.fetchone()
        if task is None:
            raise DomainValidationError("Задача не найдена")

        next_status = task["status"]
        if task["accepted_offer_id"] is None and task["status"] not in ("in_progress", "completed", "cancelled"):
            next_status = "offers" if active_offers > 0 else "open"

        cursor.execute(
            """
            UPDATE tasks
            SET
                offers_count = %s,
                status = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (active_offers, next_status, task_id),
        )

    def _reset_task_after_user_cleanup(self, cursor, task_id: int) -> None:
        cursor.execute(
            """
            SELECT COUNT(*) AS active_offers
            FROM task_offers
            WHERE task_id = %s
              AND status IN ('pending', 'accepted')
            """,
            (task_id,),
        )
        active_offers = cursor.fetchone()["active_offers"]

        cursor.execute(
            """
            SELECT status
            FROM tasks
            WHERE id = %s
            """,
            (task_id,),
        )
        task = cursor.fetchone()
        if task is None:
            return

        next_status = task["status"]
        if task["status"] != "cancelled":
            next_status = "offers" if active_offers > 0 else "open"

        cursor.execute(
            """
            UPDATE tasks
            SET
                accepted_offer_id = NULL,
                offers_count = %s,
                status = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (active_offers, next_status, task_id),
        )

    def _refresh_user_metrics(self, cursor, user_ids: list[int]) -> None:
        if not user_ids:
            return

        cursor.execute(
            """
            UPDATE users
            SET
                created_tasks_count = 0,
                completed_tasks_count = 0,
                reviews_count = 0,
                rating_avg = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ANY(%s)
            """,
            (user_ids,),
        )

        cursor.execute(
            """
            UPDATE users
            SET
                created_tasks_count = stats.created_count,
                updated_at = CURRENT_TIMESTAMP
            FROM (
                SELECT customer_id AS user_id, COUNT(*) AS created_count
                FROM tasks
                WHERE customer_id = ANY(%s)
                GROUP BY customer_id
            ) AS stats
            WHERE users.id = stats.user_id
            """,
            (user_ids,),
        )

        cursor.execute(
            """
            UPDATE users
            SET
                completed_tasks_count = stats.completed_count,
                updated_at = CURRENT_TIMESTAMP
            FROM (
                SELECT user_id, COUNT(*) AS completed_count
                FROM (
                    SELECT customer_id AS user_id
                    FROM task_assignments
                    WHERE status = 'completed'
                      AND customer_id = ANY(%s)
                    UNION ALL
                    SELECT performer_id AS user_id
                    FROM task_assignments
                    WHERE status = 'completed'
                      AND performer_id = ANY(%s)
                ) completed_rows
                GROUP BY user_id
            ) AS stats
            WHERE users.id = stats.user_id
            """,
            (user_ids, user_ids),
        )

        cursor.execute(
            """
            UPDATE users
            SET
                reviews_count = stats.review_count,
                rating_avg = stats.rating_avg,
                updated_at = CURRENT_TIMESTAMP
            FROM (
                SELECT
                    target_user_id AS user_id,
                    COUNT(*) AS review_count,
                    ROUND(AVG(rating)::numeric, 2) AS rating_avg
                FROM reviews
                WHERE is_visible = TRUE
                  AND target_user_id = ANY(%s)
                GROUP BY target_user_id
            ) AS stats
            WHERE users.id = stats.user_id
            """,
            (user_ids,),
        )

    def _seed_demo_tasks(
        self,
        cursor,
        university_id: int,
        dormitory_ids: dict[str, int],
        demo_user_ids: dict[str, int],
    ) -> None:
        now = datetime.now(UTC)
        alexey_id = demo_user_ids["alexey@campus.test"]
        maria_id = demo_user_ids["maria@campus.test"]
        nikita_id = demo_user_ids["nikita@campus.test"]

        open_task_id = self._insert_task(
            cursor,
            customer_id=alexey_id,
            university_id=university_id,
            dormitory_id=dormitory_ids["Общежитие №1"],
            title="Помочь перенести мебель в комнате",
            description="Нужно перенести стол и два стула на другой этаж.",
            category="moving",
            urgency="urgent",
            payment_type="fixed_price",
            price_amount=800,
            barter_description=None,
            visibility="university",
            status="open",
            created_at=now - timedelta(hours=2),
        )

        offers_task_id = self._insert_task(
            cursor,
            customer_id=maria_id,
            university_id=university_id,
            dormitory_id=dormitory_ids["Общежитие №2"],
            title="Купить воду и продукты после пар",
            description="Нужна помощь с покупкой воды и нескольких продуктов вечером.",
            category="delivery",
            urgency="today",
            payment_type="fixed_price",
            price_amount=550,
            barter_description=None,
            visibility="university",
            status="offers",
            created_at=now - timedelta(hours=6),
        )
        cursor.execute(
            """
            INSERT INTO task_offers (
                task_id, performer_id, message, price_amount, payment_type, barter_description, status, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'pending', %s)
            """,
            (
                offers_task_id,
                nikita_id,
                "Могу зайти в магазин по пути из корпуса и занести всё в общежитие.",
                550,
                "fixed_price",
                None,
                now - timedelta(hours=5, minutes=20),
            ),
        )
        self._sync_task_offer_state(cursor, offers_task_id)

        in_progress_task_id = self._insert_task(
            cursor,
            customer_id=alexey_id,
            university_id=university_id,
            dormitory_id=dormitory_ids["Общежитие №1"],
            title="Принести распечатки к семинару",
            description="Нужно забрать распечатки в копицентре и занести в общежитие до 19:00.",
            category="study_help",
            urgency="today",
            payment_type="fixed_price",
            price_amount=300,
            barter_description=None,
            visibility="university",
            status="in_progress",
            created_at=now - timedelta(days=1, hours=2),
        )
        cursor.execute(
            """
            INSERT INTO task_offers (
                task_id, performer_id, message, price_amount, payment_type, barter_description, status, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'accepted', %s)
            RETURNING id
            """,
            (
                in_progress_task_id,
                maria_id,
                "Заберу по пути в кампус и занесу после 18:00.",
                300,
                "fixed_price",
                None,
                now - timedelta(days=1, hours=1, minutes=30),
            ),
        )
        accepted_offer_id = cursor.fetchone()["id"]
        cursor.execute(
            """
            UPDATE tasks
            SET accepted_offer_id = %s, offers_count = 1
            WHERE id = %s
            """,
            (accepted_offer_id, in_progress_task_id),
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
                status,
                assigned_at,
                started_at,
                created_at,
                updated_at
            )
            VALUES (%s, %s, %s, %s, %s, 'fixed_price', NULL, 'in_progress', %s, %s, %s, %s)
            RETURNING id
            """,
            (
                in_progress_task_id,
                accepted_offer_id,
                alexey_id,
                maria_id,
                300,
                now - timedelta(days=1, hours=1, minutes=20),
                now - timedelta(days=1, hours=1, minutes=20),
                now - timedelta(days=1, hours=1, minutes=20),
                now - timedelta(hours=3),
            ),
        )
        assignment_id = cursor.fetchone()["id"]
        cursor.execute(
            """
            INSERT INTO task_completion_confirmations (
                task_assignment_id,
                status,
                created_at,
                updated_at
            )
            VALUES (%s, 'pending', %s, %s)
            """,
            (assignment_id, now - timedelta(days=1), now - timedelta(hours=3)),
        )
        cursor.execute(
            """
            INSERT INTO task_chats (
                task_id,
                customer_id,
                performer_id,
                created_at,
                updated_at
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                in_progress_task_id,
                alexey_id,
                maria_id,
                now - timedelta(days=1),
                now - timedelta(hours=1),
            ),
        )
        chat_id = cursor.fetchone()["id"]
        cursor.execute(
            """
            INSERT INTO chat_messages (chat_id, sender_id, body, created_at, read_at)
            VALUES
                (%s, %s, %s, %s, %s),
                (%s, %s, %s, %s, %s),
                (%s, %s, %s, %s, NULL)
            """,
            (
                chat_id,
                alexey_id,
                "Привет! Сможешь занести распечатки до 19:00?",
                now - timedelta(hours=2, minutes=20),
                now - timedelta(hours=2),
                chat_id,
                maria_id,
                "Да, уже иду в копицентр. Напишу, когда буду рядом.",
                now - timedelta(hours=2),
                now - timedelta(hours=1, minutes=50),
                chat_id,
                alexey_id,
                "Супер, спасибо! Я буду внизу у входа.",
                now - timedelta(hours=1, minutes=35),
            ),
        )

        completed_task_id = self._insert_task(
            cursor,
            customer_id=alexey_id,
            university_id=university_id,
            dormitory_id=dormitory_ids["Общежитие №1"],
            title="Генеральная уборка кухни на этаже",
            description="Нужно помочь с уборкой кухни и выносом мусора.",
            category="cleaning",
            urgency="this_week",
            payment_type="fixed_price",
            price_amount=1200,
            barter_description=None,
            visibility="university",
            status="completed",
            created_at=now - timedelta(days=5),
        )
        cursor.execute(
            """
            INSERT INTO task_offers (
                task_id, performer_id, message, price_amount, payment_type, barter_description, status, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'accepted', %s)
            RETURNING id
            """,
            (
                completed_task_id,
                nikita_id,
                "Могу помочь вечером и принести свои перчатки и средство.",
                1200,
                "fixed_price",
                None,
                now - timedelta(days=5, hours=-1),
            ),
        )
        completed_offer_id = cursor.fetchone()["id"]
        cursor.execute(
            """
            UPDATE tasks
            SET
                accepted_offer_id = %s,
                offers_count = 1,
                completed_at = %s
            WHERE id = %s
            """,
            (completed_offer_id, now - timedelta(days=4, hours=20), completed_task_id),
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
                status,
                assigned_at,
                started_at,
                completed_at,
                created_at,
                updated_at
            )
            VALUES (%s, %s, %s, %s, %s, 'fixed_price', NULL, 'completed', %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                completed_task_id,
                completed_offer_id,
                alexey_id,
                nikita_id,
                1200,
                now - timedelta(days=5, hours=-2),
                now - timedelta(days=5, hours=-2),
                now - timedelta(days=4, hours=20),
                now - timedelta(days=5, hours=-2),
                now - timedelta(days=4, hours=20),
            ),
        )
        completed_assignment_id = cursor.fetchone()["id"]
        cursor.execute(
            """
            INSERT INTO task_completion_confirmations (
                task_assignment_id,
                customer_confirmed_at,
                performer_confirmed_at,
                status,
                created_at,
                updated_at
            )
            VALUES (%s, %s, %s, 'completed', %s, %s)
            """,
            (
                completed_assignment_id,
                now - timedelta(days=4, hours=20),
                now - timedelta(days=4, hours=21),
                now - timedelta(days=5, hours=-2),
                now - timedelta(days=4, hours=20),
            ),
        )
        cursor.execute(
            """
            INSERT INTO reviews (
                task_id,
                task_assignment_id,
                author_id,
                target_user_id,
                rating,
                comment,
                moderation_status,
                created_at,
                updated_at
            )
            VALUES (%s, %s, %s, %s, 5, %s, 'approved', %s, %s)
            """,
            (
                completed_task_id,
                completed_assignment_id,
                nikita_id,
                alexey_id,
                "Очень комфортная коммуникация, всё было подготовлено заранее.",
                now - timedelta(days=4, hours=19),
                now - timedelta(days=4, hours=19),
            ),
        )

        self._insert_task(
            cursor,
            customer_id=alexey_id,
            university_id=university_id,
            dormitory_id=dormitory_ids["Общежитие №1"],
            title="Настроить старый роутер",
            description="Нужно помочь вернуть интернет после сброса настроек.",
            category="tech_help",
            urgency="flexible",
            payment_type="negotiable",
            price_amount=None,
            barter_description=None,
            visibility="university",
            status="cancelled",
            created_at=now - timedelta(days=3),
            cancelled_at=now - timedelta(days=2, hours=18),
            cancellation_reason="Уже решил проблему самостоятельно",
        )

        self._insert_notification(
            cursor,
            user_id=alexey_id,
            notification_type="chat_message_received",
            title="Есть новое сообщение по задаче",
            body="Мария ответила в чате по распечаткам.",
            entity_type="task",
            entity_id=in_progress_task_id,
            payload={"task_id": in_progress_task_id, "chat_id": chat_id},
        )
        self._insert_notification(
            cursor,
            user_id=maria_id,
            notification_type="offer_received",
            title="Новый отклик на задачу",
            body="Никита оставил отклик на задачу с доставкой.",
            entity_type="task",
            entity_id=offers_task_id,
            payload={"task_id": offers_task_id},
        )
        self._insert_notification(
            cursor,
            user_id=alexey_id,
            notification_type="task_completed_confirmed",
            title="Сделка завершена",
            body="Завершённая уборка добавлена в историю сделок.",
            entity_type="task",
            entity_id=completed_task_id,
            payload={"task_id": completed_task_id},
        )

        self._sync_task_offer_state(cursor, open_task_id)
        self._sync_task_offer_state(cursor, in_progress_task_id)
        self._sync_task_offer_state(cursor, completed_task_id)

    def _insert_task(
        self,
        cursor,
        *,
        customer_id: int,
        university_id: int,
        dormitory_id: int,
        title: str,
        description: str,
        category: str,
        urgency: str,
        payment_type: str,
        price_amount: int | None,
        barter_description: str | None,
        visibility: str,
        status: str,
        created_at: datetime,
        cancelled_at: datetime | None = None,
        cancellation_reason: str | None = None,
    ) -> int:
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
                visibility,
                status,
                published_at,
                created_at,
                updated_at,
                cancelled_at,
                cancellation_reason
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
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
                visibility,
                status,
                created_at,
                created_at,
                created_at,
                cancelled_at,
                cancellation_reason,
            ),
        )
        return cursor.fetchone()["id"]
