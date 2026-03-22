from typing import Any

from ..core.database import get_connection


class ReportRepository:
    def create_report(
        self,
        *,
        reporter_id: int,
        target_type: str,
        target_id: int,
        reason_code: str,
        comment: str | None,
    ) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO reports (
                        reporter_id,
                        target_type,
                        target_id,
                        reason_code,
                        comment,
                        status
                    )
                    VALUES (%s, %s, %s, %s, %s, 'pending')
                    RETURNING
                        id,
                        reporter_id,
                        target_type,
                        target_id,
                        reason_code,
                        comment,
                        status,
                        resolved_by_user_id,
                        resolved_at,
                        created_at
                    """,
                    (reporter_id, target_type, target_id, reason_code, comment),
                )
                row = cursor.fetchone()
            connection.commit()
        return row

    def list_reports(self) -> list[dict[str, Any]]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        reporter_id,
                        target_type,
                        target_id,
                        reason_code,
                        comment,
                        status,
                        resolved_by_user_id,
                        resolved_at,
                        created_at
                    FROM reports
                    ORDER BY created_at DESC
                    """,
                )
                return list(cursor.fetchall())

    def resolve_report(
        self,
        *,
        report_id: int,
        moderator_id: int,
        resolution: str,
        comment: str | None,
    ) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE reports
                    SET
                        status = %s,
                        comment = COALESCE(%s, comment),
                        resolved_by_user_id = %s,
                        resolved_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING
                        id,
                        reporter_id,
                        target_type,
                        target_id,
                        reason_code,
                        comment,
                        status,
                        resolved_by_user_id,
                        resolved_at,
                        created_at
                    """,
                    (resolution, comment, moderator_id, report_id),
                )
                row = cursor.fetchone()
            connection.commit()
        return row

    def delete_all_reports(self) -> None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM reports")
            connection.commit()
