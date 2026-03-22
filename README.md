# DormEX

DormEX - веб-приложение для общежития: задачи, отклики, чаты, уведомления и аналитика.

Проект состоит из:

- `frontend/` - React + Vite интерфейс
- `backend/` - FastAPI API
- `postgres`, `liquibase`, `mailhog`, `nginx` - инфраструктура через Docker Compose

## Стек

- frontend: React 18, TypeScript, Vite, Tailwind
- backend: FastAPI, Python 3.11, PostgreSQL
- infra: Docker Compose, Nginx, Liquibase, MailHog

## Деплой

Деплой и обновление окружения нужно выполнять только через:

```bash
./deploy.sh
```

Не используй для деплоя ручные команды вроде `docker compose up`, `docker build` или ручную пересборку образов. В этом репозитории штатный сценарий выкладки зафиксирован именно в `./deploy.sh`.

Скрипт:

- останавливает текущие контейнеры
- удаляет старые образы приложения
- пересобирает backend и nginx image
- поднимает сервисы заново через Docker Compose

После деплоя приложение будет доступно по адресу `http://localhost:${NGINX_HOST_PORT:-8080}/dormex/`.

## Демо-данные и вход

Backend при старте подготавливает локальные данные:

- университет с доменом `campus.test`
- несколько общежитий
- demo-задачи в разных статусах
- отклики, сообщения, отзывы и уведомления

Swagger использует Basic Auth. Для входа в `/docs` используй admin-учётные данные.

Поддерживаются два сценария входа:

- регистрация и логин через интерфейс
- вход по email-коду через API `auth/email/request-code` и `auth/email/verify-code`

Для локальной почты по умолчанию используется MailHog. Если нужен реальный SMTP, заполни `.env` на основе `.env.example`.

## Разработчику

### Что нужно

- Docker и Docker Compose
- Node.js 20+
- npm
- Python 3.11

### Локальная разработка через Compose

Если нужен полный стек без ручной сборки сервисов:

```bash
cp .env.example .env
docker compose up --build
```

Это основной и самый простой способ локальной разработки, если нужен frontend, backend, база, миграции и MailHog сразу.

После запуска доступны:

- приложение: `http://localhost:8080/dormex/`
- API через nginx: `http://localhost:8080/api/v1`
- Swagger: `http://localhost:8080/docs`
- backend напрямую: `http://localhost:3000`
- PostgreSQL: `localhost:5433`
- MailHog UI: `http://localhost:8025`

Если на машине свободен `80` порт, можно пробросить nginx туда:

```bash
NGINX_HOST_PORT=80 docker compose up --build
```

### Раздельный запуск frontend и backend

Если нужно разрабатывать frontend и backend отдельно:

1. Подними инфраструктуру:

```bash
cp .env.example .env
docker compose up -d postgres liquibase mailhog
```

2. Запусти backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL=postgresql://campus_user:campus_pass@localhost:5433/campus_exchange uvicorn app.main:app --reload --host 0.0.0.0 --port 3000
```

3. Запусти frontend:

```bash
cd frontend
npm ci
VITE_API_BASE_URL=http://localhost:3000/api/v1 npm run dev
```

В dev-режиме Vite работает на `http://localhost:5173`, backend на `http://localhost:3000`.

### Полезные команды

Frontend:

```bash
cd frontend
npm run lint
npm run test
npm run build
```

Backend:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 3000
```

Логи backend в Docker:

```bash
docker compose logs -f backend
```

### Переменные окружения

Основные переменные лежат в `.env.example`:

- `NGINX_HOST_PORT`
- `AUTH_ALLOW_ANY_EMAIL_DOMAIN`
- `EMAIL_CODE_TTL_SEC`
- `EMAIL_CODE_RESEND_INTERVAL_SEC`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_USE_TLS`
- `SMTP_USE_SSL`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `ADMIN_EMAIL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## Миграции

Liquibase changelog лежит в `backend/liquibase/changelog/db.changelog-master.yaml`.
