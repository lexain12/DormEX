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

- app через nginx: `http://localhost/dormex/`
- backend api через nginx: `http://localhost/api/v1`
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
- demo-пользователи:
  - `alexey@campus.test`
  - `maria@campus.test`
  - `nikita@campus.test`
- несколько задач в состояниях `open`, `offers`, `in_progress`, `completed`, `cancelled`;
- отклики, чат, отзывы и уведомления.

Для локального входа email-код сейчас фиксированный:

- код подтверждения: `123456`

Это сделано специально для интеграционного тестирования, пока реальная отправка email не подключена.

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

По умолчанию локальная авторизация отправляет одноразовый код по SMTP в MailHog:

- открой `http://localhost:8025`;
- запроси код для email с доменом `campus.test`;
- письмо появится в интерфейсе MailHog;
- возьми код из письма и введи его во frontend.

Если хочешь использовать настоящую почту, а не MailHog:

1. Скопируй `.env.example` в `.env`
2. Заполни в `.env` свои SMTP-настройки и почтовый ключ/app password
3. Оставь `AUTH_ALLOW_ANY_EMAIL_DOMAIN=true`, если хочешь входить с обычных email вроде `mail.ru`, `gmail.com`, `yandex.ru`
4. Перезапусти проект: `docker compose up --build -d`

В `.env.example` уже оставлены поля, куда нужно вставить секреты:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_USE_TLS`
- `SMTP_USE_SSL`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `EMAIL_CODE_TTL_SEC`
- `EMAIL_CODE_RESEND_INTERVAL_SEC`
- `AUTH_ALLOW_ANY_EMAIL_DOMAIN`

Для популярных провайдеров можно использовать такие стартовые значения:

- Mail.ru: `SMTP_HOST=smtp.mail.ru`, `SMTP_PORT=465`, `SMTP_USE_SSL=true`
- Yandex: `SMTP_HOST=smtp.yandex.ru`, `SMTP_PORT=465`, `SMTP_USE_SSL=true`
- Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USE_TLS=true`

## Миграции

Liquibase changelog лежит в [backend/liquibase/changelog/db.changelog-master.yaml](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/liquibase/changelog/db.changelog-master.yaml).
