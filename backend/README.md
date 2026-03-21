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

## Email auth

Вход работает через одноразовый код подтверждения:

- `POST /api/v1/auth/email/request-code` генерирует случайный код;
- код хранится в БД только в виде хеша;
- одновременно активен только последний код для email;
- повторная отправка ограничена интервалом `EMAIL_CODE_RESEND_INTERVAL_SEC`;
- срок жизни кода задаётся через `EMAIL_CODE_TTL_SEC`.

Локально письмо отправляется в MailHog:

- SMTP: `mailhog:1025`
- web UI: `http://localhost:8025`

Если нужен реальный внешний SMTP, можно заполнить `.env` на основе `.env.example`.

Основные переменные:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_USE_TLS`
- `SMTP_USE_SSL`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`

Для входа с обычных реальных email вроде `mail.ru` или `gmail.com` включи:

- `AUTH_ALLOW_ANY_EMAIL_DOMAIN=true`

В этом режиме неизвестные email-домены будут авторизовываться в локальном demo-университете, чтобы можно было тестировать приложение реальными ящиками без изменения backend-логики и seed-данных.
