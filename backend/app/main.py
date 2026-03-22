from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from .controllers.api_controller import router as api_router
from .controllers.health_controller import router as health_router
from .core.error_handlers import register_error_handlers
from .repositories.platform_repository import PlatformRepository
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
docs_basic_auth = HTTPBasic()

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


def _authorize_swagger(credentials: HTTPBasicCredentials = Depends(docs_basic_auth)) -> dict:
    user = PlatformRepository().verify_credentials_and_get_user(credentials.username, credentials.password)
    if user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Swagger доступен только администратору",
            headers={"WWW-Authenticate": "Basic"},
        )
    return user


def _build_openapi_schema() -> dict:
    return get_openapi(
        title=app.title,
        version=app.version,
        description=(
            "DormEX backend API.\n\n"
            "Swagger вход защищён Basic Auth."
        ),
        routes=app.routes,
    )


@app.get("/openapi.json", include_in_schema=False)
def openapi_schema(_: dict = Depends(_authorize_swagger)) -> JSONResponse:
    if app.openapi_schema is None:
        app.openapi_schema = _build_openapi_schema()
    return JSONResponse(app.openapi_schema)


@app.get("/docs", include_in_schema=False)
def swagger_ui(_: dict = Depends(_authorize_swagger)):
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title=f"{app.title} - Swagger UI",
    )


@app.on_event("startup")
def on_startup() -> None:
    BootstrapService().ensure_bootstrap_data()
