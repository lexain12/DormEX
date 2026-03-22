from collections.abc import Iterable

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from .controllers.admin_controller import router as admin_router
from .controllers.api_controller import router as api_router
from .controllers.health_controller import router as health_router
from .core.error_handlers import register_error_handlers
from .services.bootstrap_service import BootstrapService


app = FastAPI(
    title="Campus Exchange Hub API",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    openapi_tags=[
        {"name": "health", "description": "Проверка доступности сервиса"},
        {"name": "auth", "description": "Авторизация, регистрация и сессии"},
        {"name": "admin", "description": "Административные операции"},
        {"name": "profile", "description": "Текущий пользователь"},
        {"name": "reference", "description": "Справочные данные"},
        {"name": "users", "description": "Публичные данные пользователей"},
        {"name": "tasks", "description": "Задачи и их жизненный цикл"},
        {"name": "offers", "description": "Отклики и встречные предложения"},
        {"name": "chats", "description": "Чаты и сообщения"},
        {"name": "notifications", "description": "Уведомления"},
        {"name": "analytics", "description": "Аналитика по категориям"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(health_router)
app.include_router(api_router)
app.include_router(admin_router)


def _iter_operations(path_item: dict) -> Iterable[dict]:
    for method in ("get", "post", "put", "patch", "delete", "options", "head"):
        operation = path_item.get(method)
        if isinstance(operation, dict):
            yield operation


def _build_openapi_schema() -> dict:
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=(
            "DormEX backend API.\n\n"
            "Swagger использует только Basic auth по логину и паролю. "
            "Обычные операции доступны любому аутентифицированному пользователю, "
            "а операции с тегом admin доступны только администратору."
        ),
        routes=app.routes,
    )
    components = schema.setdefault("components", {})
    security_schemes = components.setdefault("securitySchemes", {})
    security_schemes["basicAuth"] = {
        "type": "http",
        "scheme": "basic",
        "description": "Логин и пароль пользователя. Администратор получает доступ и к admin endpoints.",
    }

    for path, path_item in schema.get("paths", {}).items():
        for operation in _iter_operations(path_item):
            if path.startswith("/api/v1/auth/"):
                operation["security"] = []
            else:
                operation["security"] = [{"basicAuth": []}]

    return schema


@app.get("/openapi.json", include_in_schema=False)
def openapi_schema() -> JSONResponse:
    if app.openapi_schema is None:
        app.openapi_schema = _build_openapi_schema()
    return JSONResponse(app.openapi_schema)


@app.get("/docs", include_in_schema=False)
def swagger_ui():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title=f"{app.title} - Swagger UI",
        swagger_ui_parameters={"persistAuthorization": True},
    )


@app.on_event("startup")
def on_startup() -> None:
    BootstrapService().ensure_bootstrap_data()
