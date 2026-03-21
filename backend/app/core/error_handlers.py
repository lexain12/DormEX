from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .exceptions import DomainValidationError


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
        if first_error is not None:
            field_parts = [str(part) for part in first_error["loc"] if part not in ("body", "query", "path")]
            if field_parts:
                field = ".".join(field_parts)

        details: dict[str, Any] = {"errors": exc.errors()}
        if field is not None:
            details["field"] = field

        return JSONResponse(
            status_code=422,
            content=build_error_payload(
                code="validation_error",
                message="Invalid request payload",
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
