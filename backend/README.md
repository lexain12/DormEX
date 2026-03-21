# Backend

Backend работает на `FastAPI` и организован по слоям:

- `controllers` — HTTP-ручки;
- `services` — use-case логика;
- `repositories` — SQL и работа с PostgreSQL;
- `schemas` — Pydantic request-модели;
- `core` — токены, ошибки, БД и общая инфраструктура.

## Что реализовано сейчас

Локально backend уже закрывает текущий frontend-контракт из `docs/API.md`:

- `auth`: request-code, verify-code, refresh, logout;
- `me` и onboarding;
- `reference/dormitories`;
- `users`, `me/tasks`;
- `tasks`, `offers`, `counter-offers`;
- `chats`;
- `notifications`;
- `analytics/categories/{category}`.

## Ключевые файлы

- `app/main.py` — точка входа, регистрация router'ов, startup bootstrap.
- `app/controllers/api_controller.py` — основной router `/api/v1`.
- `app/services/platform_service.py` — orchestration use-case сценариев для API.
- `app/repositories/platform_repository.py` — SQL-логика по auth/tasks/offers/chats/notifications/analytics.
- `app/services/bootstrap_service.py` — подготовка reference/demo-данных на старте.
- `app/core/auth_tokens.py` — access/refresh токены для локальной интеграции.

## Локальная интеграция

При старте backend создаёт:

- университет с email-доменом `campus.test`;
- несколько общежитий;
- demo-пользователей;
- demo-задачи и связанные сущности.

Пока не подключена реальная email-отправка, локальный код подтверждения фиксированный:

- `123456`

Это позволяет руками проверить связку frontend/backend без моков.
