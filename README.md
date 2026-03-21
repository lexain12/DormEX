# Campus Exchange Hub

Проект разделен на две части:

- `frontend/` - React/Vite интерфейс
- `backend/` - Python backend
- `postgres` и `liquibase` поднимаются через Docker Compose

## Запуск через Docker Compose

```bash
docker compose up --build
```

Если нужно пересобрать контейнеры без кэша:

```bash
docker compose build --no-cache
docker compose up -d
```

Сервисы будут доступны по адресам:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`
- swagger: `http://localhost:3000/docs`
- redoc: `http://localhost:3000/redoc`
- postgres: `localhost:5433`

## Что внутри

- PostgreSQL как основная база данных
- Liquibase для миграций схемы
- FastAPI backend, который работает через `DATABASE_URL`
- Vite frontend в отдельном контейнере

## Миграции

Liquibase changelog лежит в [backend/liquibase/changelog/db.changelog-master.yaml](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/liquibase/changelog/db.changelog-master.yaml).
