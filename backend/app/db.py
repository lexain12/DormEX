import os
from contextlib import contextmanager
from typing import Any, Iterator

from psycopg import connect
from psycopg.rows import dict_row


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://campus_user:campus_pass@localhost:5432/campus_exchange",
)


@contextmanager
def get_connection() -> Iterator:
    with connect(DATABASE_URL, row_factory=dict_row) as connection:
        yield connection


def ping_db() -> None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")


def list_tasks() -> list[dict[str, Any]]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, title, description, category, dorm, price, payment_type, urgency, status, created_at
                FROM tasks
                ORDER BY id DESC
                """
            )
            return list(cursor.fetchall())


def get_task(task_id: int) -> dict[str, Any] | None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, title, description, category, dorm, price, payment_type, urgency, status, created_at
                FROM tasks
                WHERE id = %s
                """,
                (task_id,),
            )
            return cursor.fetchone()


def create_task(payload: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tasks (
                    title, description, category, dorm, price, payment_type, urgency, status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, title, description, category, dorm, price, payment_type, urgency, status, created_at
                """,
                (
                    payload["title"],
                    payload["description"],
                    payload["category"],
                    payload["dorm"],
                    payload.get("price"),
                    payload["payment_type"],
                    payload["urgency"],
                    "open",
                ),
            )
            task = cursor.fetchone()
        connection.commit()

    if task is None:
        raise RuntimeError("Failed to create task")
    return task
