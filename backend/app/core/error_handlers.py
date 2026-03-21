from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .exceptions import (
    AuthenticationError,
    DomainValidationError,
    ExternalServiceError,
    ForbiddenError,
    TooManyRequestsError,
)


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def build_error_payload(
    *,
    code: str,
    message: str,
    details: Any | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    if details is not None:
        payload["error"]["details"] = details
    return payload


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(TooManyRequestsError)
    async def too_many_requests_handler(_, exc: TooManyRequestsError) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content=build_error_payload(
                code="rate_limited",
                message=str(exc),
            ),
        )

    @app.exception_handler(ExternalServiceError)
    async def external_service_handler(_, exc: ExternalServiceError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content=build_error_payload(
                code="service_unavailable",
                message=str(exc),
            ),
        )

    @app.exception_handler(AuthenticationError)
    async def authentication_handler(_, exc: AuthenticationError) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content=build_error_payload(
                code="unauthorized",
                message=str(exc),
            ),
        )

    @app.exception_handler(ForbiddenError)
    async def forbidden_handler(_, exc: ForbiddenError) -> JSONResponse:
        return JSONResponse(
            status_code=403,
            content=build_error_payload(
                code="forbidden",
                message=str(exc),
            ),
        )

    @app.exception_handler(DomainValidationError)
    async def domain_validation_handler(_, exc: DomainValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content=build_error_payload(
                code="validation_error",
                message=str(exc),
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(_, exc: RequestValidationError) -> JSONResponse:
        first_error = exc.errors()[0] if exc.errors() else None
        field = None
        message = "Invalid request payload"
        if first_error is not None:
            field_parts = [str(part) for part in first_error["loc"] if part not in ("body", "query", "path")]
            if field_parts:
                field = ".".join(field_parts)
            raw_message = str(first_error.get("msg") or "").strip()
            if raw_message:
                message = raw_message.removeprefix("Value error, ").strip() or message

        details: dict[str, Any] = {"errors": _json_safe(exc.errors())}
        if field is not None:
            details["field"] = field

        return JSONResponse(
            status_code=422,
            content=build_error_payload(
                code="validation_error",
                message=message,
                details=details,
            ),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_, exc: HTTPException) -> JSONResponse:
        if isinstance(exc.detail, dict) and "error" in exc.detail:
            return JSONResponse(status_code=exc.status_code, content=exc.detail)

        code = "not_found" if exc.status_code == 404 else "http_error"
        return JSONResponse(
            status_code=exc.status_code,
            content=build_error_payload(
                code=code,
                message=str(exc.detail),
            ),
        )
