from typing import Any

from ..core.database import get_connection


class AnalyticsRepository:
    def get_category_analytics(self, *, category: str) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        COUNT(*) AS completed_tasks_count,
                        ROUND(AVG(price_amount) FILTER (WHERE payment_type = 'fixed_price'), 2) AS avg_price_amount,
                        MIN(price_amount) FILTER (WHERE payment_type = 'fixed_price') AS min_price_amount,
                        MAX(price_amount) FILTER (WHERE payment_type = 'fixed_price') AS max_price_amount,
                        ROUND(
                            AVG(EXTRACT(EPOCH FROM (completed_at - COALESCE(starts_at, created_at))) / 60)
                            FILTER (WHERE completed_at IS NOT NULL),
                            2
                        ) AS avg_completion_minutes
                    FROM tasks
                    WHERE category = %s
                      AND status = 'completed'
                    """,
                    (category,),
                )
                aggregate = cursor.fetchone()

                cursor.execute(
                    """
                    SELECT
                        percentile_cont(0.5) WITHIN GROUP (ORDER BY price_amount) AS median_price_amount
                    FROM tasks
                    WHERE category = %s
                      AND status = 'completed'
                      AND payment_type = 'fixed_price'
                      AND price_amount IS NOT NULL
                    """,
                    (category,),
                )
                median = cursor.fetchone()

                cursor.execute(
                    """
                    SELECT
                        bucket,
                        COUNT(*) AS count
                    FROM (
                        SELECT
                            CASE
                                WHEN price_amount <= 200 THEN '0-200'
                                WHEN price_amount <= 400 THEN '200-400'
                                WHEN price_amount <= 600 THEN '400-600'
                                WHEN price_amount <= 800 THEN '600-800'
                                WHEN price_amount <= 1000 THEN '800-1000'
                                ELSE '1000+'
                            END AS bucket
                        FROM tasks
                        WHERE category = %s
                          AND status = 'completed'
                          AND payment_type = 'fixed_price'
                          AND price_amount IS NOT NULL
                    ) stats
                    GROUP BY bucket
                    ORDER BY MIN(bucket)
                    """,
                    (category,),
                )
                histogram = list(cursor.fetchall())

        return {
            "category": category,
            "completed_tasks_count": aggregate["completed_tasks_count"] if aggregate is not None else 0,
            "avg_price_amount": float(aggregate["avg_price_amount"]) if aggregate and aggregate["avg_price_amount"] is not None else None,
            "median_price_amount": float(median["median_price_amount"]) if median and median["median_price_amount"] is not None else None,
            "min_price_amount": aggregate["min_price_amount"] if aggregate is not None else None,
            "max_price_amount": aggregate["max_price_amount"] if aggregate is not None else None,
            "avg_completion_minutes": float(aggregate["avg_completion_minutes"]) if aggregate and aggregate["avg_completion_minutes"] is not None else None,
            "price_histogram": [
                {"range": row["bucket"], "count": row["count"]}
                for row in histogram
            ],
        }

    def delete_all_analytics(self) -> None:
        # Analytics are derived from tasks, offers, etc., so no direct delete needed
        pass
