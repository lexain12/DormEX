from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .db import create_task, get_task, list_tasks, ping_db


class TaskCreate(BaseModel):
    title: str
    description: str
    category: str
    dorm: str
    price: int | None = None
    payment_type: str = "money"
    urgency: str = "none"


app = FastAPI(
    title="Campus Exchange Hub API",
    description="API для Campus Exchange Hub: healthcheck, просмотр задач и создание заявок.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
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


@app.get("/health")
def healthcheck() -> dict[str, str]:
    ping_db()
    return {"status": "ok"}


@app.get("/tasks")
def tasks() -> list[dict[str, Any]]:
    return list_tasks()


@app.get("/tasks/{task_id}")
def task_detail(task_id: int) -> dict[str, Any]:
    task = get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.post("/tasks", status_code=201)
def task_create(payload: TaskCreate) -> dict[str, Any]:
    return create_task(payload.model_dump())
