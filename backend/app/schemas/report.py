from datetime import datetime

from pydantic import BaseModel


class ReportCreateRequest(BaseModel):
    target_type: str
    target_id: int
    reason_code: str
    comment: str | None = None


class ReportResponse(BaseModel):
    id: int
    reporter_id: int
    target_type: str
    target_id: int
    reason_code: str
    comment: str | None = None
    status: str
    resolved_by_user_id: int | None = None
    resolved_at: datetime | None = None
    created_at: datetime


class ModerationResolveReportRequest(BaseModel):
    resolution: str
    comment: str | None = None
