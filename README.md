# Campus Exchange Hub

Проект разделен на две части:

- `frontend/` - React/Vite интерфейс
- `backend/` - Python backend
- `postgres` и `liquibase` поднимаются через Docker Compose

## Запуск через Docker Compose

```bash
docker compose up --build
```

Если у тебя свободен `:80`, можно вернуть поведение старого nginx-конфига:

```bash
NGINX_HOST_PORT=80 docker compose up --build
```

Сервисы будут доступны по адресам:

- frontend через nginx: `http://localhost:8080/dormex/`
- backend api через nginx: `http://localhost:8080/api/v1`
- Swagger backend через nginx: `http://localhost:8080/docs`
- Swagger backend напрямую: `http://localhost:3000/docs`
- backend напрямую: `http://localhost:3000`
- postgres: `localhost:5433`
- MailHog UI: `http://localhost:8025`

## Что внутри

- PostgreSQL как основная база данных
- Liquibase для миграций схемы
- FastAPI backend, который работает через `DATABASE_URL`
- Nginx раздаёт собранный frontend и проксирует API в backend

## Локальный вход и demo-данные

Backend при старте подготавливает локальные demo-данные для ручной проверки интеграции frontend/backend:

- университет с доменом `campus.test`;
- 3 общежития;
- несколько задач в состояниях `open`, `offers`, `in_progress`, `completed`, `cancelled`;
- отклики, чат, отзывы и уведомления.

Поддерживаются два варианта входа:

- по логину и паролю после регистрации через форму во frontend или `POST /auth/register`
- по email-коду через `POST /auth/email/request-code` и `POST /auth/email/verify-code`

Локальный административный аккаунт создаётся автоматически при старте backend:

- логин: `admin`
- пароль: `123`

Swagger backend защищён basic auth и при входе в `/docs` запросит эти admin-учётные данные.

Административные ручки скрыты из Swagger UI, но backend-эндпоинты остаются доступны напрямую:

- `POST /api/v1/admin/accounts` — создать новый административный аккаунт
- `DELETE /api/v1/admin/users/{user_id}` — удалить пользователя и связанные с ним сущности

Для почтового сценария локально можно использовать MailHog:

- открой `http://localhost:8025`
- запроси код для email с доменом `campus.test`
- письмо появится в интерфейсе MailHog
- возьми код из письма и введи его во frontend

Если хочешь отправлять код в реальный почтовый ящик, проверь SMTP-настройки в `.env` и используй app password почтового провайдера. При ошибке backend теперь пишет подробную SMTP-причину в логи контейнера:

```bash
docker compose logs -f backend
```

## Миграции

Liquibase changelog лежит в `backend/liquibase/changelog/db.changelog-master.yaml`.
