from pydantic import BaseModel


class PriceHistogramItem(BaseModel):
    range: str
    count: int


class CategoryAnalyticsFullResponse(BaseModel):
    category: str
    completed_tasks_count: int
    avg_price_amount: float | None = None
    median_price_amount: float | None = None
    min_price_amount: int | None = None
    max_price_amount: int | None = None
    avg_completion_minutes: float | None = None
    price_histogram: list[PriceHistogramItem]
