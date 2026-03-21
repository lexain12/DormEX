# Backend

Этот backend написан на `FastAPI` и сейчас организован по слоям, близко к привычной Java-структуре:

- `controller` — принимает HTTP-запросы и возвращает HTTP-ответы;
- `service` — содержит бизнес-логику;
- `repository` — работает с базой данных;
- `schema` — описывает request/response модели;
- `core` — общая инфраструктура и базовые исключения.

## Структура

### [app/main.py](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/main.py)

Точка входа backend-приложения.

Отвечает за:

- создание `FastAPI` приложения;
- подключение `CORS`;
- регистрацию роутеров из папки `controllers`.

### [app/controllers](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/controllers)

Папка с HTTP-ручками.

Задача контроллеров:

- принять запрос;
- провалидировать вход через схемы;
- вызвать нужный сервис;
- преобразовать ошибки домена в HTTP-ответы.

Файлы:

- [health_controller.py](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/controllers/health_controller.py) — ручки healthcheck.
- [task_controller.py](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/controllers/task_controller.py) — ручки задач: список, детальная карточка, создание.

### [app/services](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/services)

Папка с бизнес-логикой.

Задача сервисов:

- инкапсулировать use-case сценарии;
- не держать SQL внутри контроллера;
- быть промежуточным слоем между HTTP и базой данных.

Файлы:

- [health_service.py](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/services/health_service.py) — логика проверки доступности backend/БД.
- [task_service.py](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/services/task_service.py) — сценарии работы с задачами.

### [app/repositories](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/repositories)

Папка доступа к данным.

Задача репозиториев:

- выполнять SQL-запросы;
- читать и записывать данные в PostgreSQL;
- не знать про HTTP-слой.

Файлы:

- [task_repository.py](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/repositories/task_repository.py) — SQL для задач: фильтрация, получение карточки, создание.

### [app/schemas](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/schemas)

Pydantic-схемы запросов и ответов.

Задача схем:

- описывать JSON body;
- валидировать входные данные;
- формировать понятный контракт API для Swagger/OpenAPI.

Файлы:

- [task.py](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/schemas/task.py) — схемы для `tasks`: request body, query enum-типы, response DTO.

### [app/core](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/core)

Базовая инфраструктура backend.

Файлы:

- [database.py](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/core/database.py) — подключение к PostgreSQL и `get_connection()`.
- [exceptions.py](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/app/core/exceptions.py) — общие доменные исключения, например `DomainValidationError`.

## Как проходит запрос

Пример для `POST /tasks`:

1. Контроллер принимает JSON body через `TaskCreateRequest`.
2. Pydantic валидирует поля и правила оплаты.
3. Контроллер вызывает `TaskService`.
4. Сервис делегирует запись в `TaskRepository`.
5. Репозиторий выполняет SQL в PostgreSQL.
6. Результат поднимается обратно вверх и возвращается как response model.

## Почему такая структура

Такой подход нужен, чтобы:

- не смешивать HTTP-логику и SQL в одном файле;
- упростить поддержку по мере роста количества сущностей;
- сделать код ближе к привычной архитектуре `controller/service/repository` из Java Spring;
- упростить добавление новых модулей: `users`, `offers`, `reviews`, `notifications`.

## Как добавлять новую сущность

Для новой сущности лучше придерживаться одного и того же шаблона:

1. создать схемы в `app/schemas/`;
2. создать репозиторий в `app/repositories/`;
3. создать сервис в `app/services/`;
4. создать контроллер в `app/controllers/`;
5. подключить роутер в `app/main.py`;
6. при необходимости добавить миграцию в `backend/liquibase/changelog/`.

## Миграции

Схема базы данных управляется через Liquibase.

Основные файлы:

- [db.changelog-master.yaml](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/liquibase/changelog/db.changelog-master.yaml)
- [002_rebuild_mvp_schema.sql](/Users/pelmeshka127/Desktop/Хакатоны/campus-exchange-hub-01/backend/liquibase/changelog/sql/002_rebuild_mvp_schema.sql)
