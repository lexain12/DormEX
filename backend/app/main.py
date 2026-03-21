from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .controllers.api_controller import router as api_router
from .controllers.health_controller import router as health_router
from .core.error_handlers import register_error_handlers
from .services.bootstrap_service import BootstrapService


app = FastAPI(
    title="Campus Exchange Hub API",
    version="0.1.0",
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


@app.on_event("startup")
def on_startup() -> None:
    BootstrapService().ensure_bootstrap_data()
