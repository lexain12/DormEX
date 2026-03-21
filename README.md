# Campus Exchange Hub

Проект разделен на две части:

- `frontend/` - React/Vite интерфейс
- `backend/` - Python backend
- `postgres` и `liquibase` поднимаются через Docker Compose

## Запуск через Docker Compose

```bash
docker compose up --build
```

Сервисы будут доступны по адресам:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`
- postgres: `localhost:5433`

## Что внутри

- PostgreSQL как основная база данных
- Liquibase для миграций схемы
- FastAPI backend, который работает через `DATABASE_URL`
- Vite frontend в отдельном контейнере

## Локальный вход и demo-данные

Backend при старте подготавливает локальные demo-данные для ручной проверки интеграции frontend/backend:

- университет с доменом `campus.test`;
- 3 общежития;
- demo-пользователи:
  - `alexey@campus.test`
  - `maria@campus.test`
  - `nikita@campus.test`
- несколько задач в состояниях `open`, `offers`, `in_progress`, `completed`, `cancelled`;
- отклики, чат, отзывы и уведомления.

Для локального входа email-код сейчас фиксированный:

- код подтверждения: `123456`

Это сделано специально для интеграционного тестирования, пока реальная отправка email не подключена.

## Миграции

Liquibase changelog лежит в [backend/liquibase/changelog/db.changelog-master.yaml](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/liquibase/changelog/db.changelog-master.yaml).
