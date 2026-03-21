from fastapi import APIRouter, Depends

from .dependencies import get_current_user_context
from ..schemas.report import ModerationResolveReportRequest, ReportCreateRequest, ReportResponse
from ..services.current_user_service import CurrentUserContext
from ..services.report_service import ReportService


router = APIRouter(tags=["reports"])
report_service = ReportService()


@router.post("/api/v1/reports", response_model=ReportResponse)
def create_report(
    payload: ReportCreateRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> ReportResponse:
    return ReportResponse.model_validate(
        report_service.create_report(payload=payload.model_dump(), current_user=current_user)
    )


@router.get("/api/v1/moderation/reports", response_model=list[ReportResponse])
def list_reports(
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> list[ReportResponse]:
    return [ReportResponse.model_validate(item) for item in report_service.list_reports(current_user=current_user)]


@router.post("/api/v1/moderation/reports/{report_id}/resolve", response_model=ReportResponse)
def resolve_report(
    report_id: int,
    payload: ModerationResolveReportRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
) -> ReportResponse:
    return ReportResponse.model_validate(
        report_service.resolve_report(report_id=report_id, payload=payload.model_dump(), current_user=current_user)
    )
