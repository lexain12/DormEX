from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .controllers.auth_controller import router as auth_router
from .controllers.health_controller import router as health_router
from .controllers.task_controller import router as task_router
from .controllers.user_controller import router as user_router
from .core.error_handlers import register_error_handlers


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
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(task_router)
