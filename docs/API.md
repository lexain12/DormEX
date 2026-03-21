# DormHub / CampusHelp API

Документ описывает MVP API и минимальную схему БД для сервиса взаимопомощи внутри университета и его общежитий.

## 1. Границы MVP

MVP покрывает:

- вход по университетской почте;
- автоматическую привязку пользователя к университету;
- создание и просмотр заявок;
- отклики исполнителей;
- выбор одного исполнителя;
- встроенный чат по заказу;
- подтверждение выполнения обеими сторонами;
- отзывы и рейтинг;
- базовую модерацию жалоб и отзывов.

Не включено в MVP:

- онлайн-оплата;
- email-рассылки и сложные маркетинговые сценарии;
- сложная RBAC-модель;
- несколько исполнителей на одну задачу;
- публичный маркетплейс вне университета.

## 2. Базовые правила домена

### Роли

- `student` — обычный пользователь.
- `moderator` — модерация жалоб, отзывов и спорных кейсов.
- `admin` — управление справочниками и структурой общежитий.

### Статусы задачи

- `open` — заявка создана, ждёт откликов.
- `offers` — есть хотя бы один отклик.
- `in_progress` — заказчик выбрал исполнителя.
- `completed` — обе стороны подтвердили выполнение.
- `cancelled` — задача отменена.

### Статусы отклика

- `pending` — отклик создан, ожидает решения.
- `accepted` — отклик выбран заказчиком.
- `rejected` — отклик отклонён.
- `withdrawn` — исполнитель сам отозвал отклик.

### Подтверждение выполнения

- `pending` — никто не подтвердил.
- `customer_confirmed` — подтвердил заказчик.
- `performer_confirmed` — подтвердил исполнитель.
- `completed` — подтвердили обе стороны.
- `disputed` — одна из сторон открыла спор.

### Источник принадлежности к университету

Для MVP достаточно university email:

- домен email маппится на `university`;
- пользователь выбирает `dormitory` из доступных вариантов своего университета;
- при необходимости модератор может вручную скорректировать принадлежность.
- по умолчанию пользователь видит заявки из всех общежитий своего университета, не только из своего.

## 3. Справочники

### Категории задач

- `cleaning` — уборка и бытовая помощь
- `moving` — перенос вещей
- `delivery` — доставка и покупки
- `tech_help` — техпомощь
- `study_help` — печать / учебная помощь
- `other` — прочие поручения

### Срочность

- `urgent`
- `today`
- `this_week`
- `flexible`

### Способ оплаты

- `fixed_price` — фиксированная сумма
- `negotiable` — договорная цена
- `barter` — услуга взамен

Для `barter` одного `payment_type` недостаточно: нужно хранить `barter_description`, то есть что именно предлагается взамен.

### Видимость задачи

- `dormitory` — только для своего общежития
- `university` — для всех общежитий университета, это режим по умолчанию и основной сценарий MVP

## 4. Сущности БД

Ниже минимальный набор таблиц для PostgreSQL.

### 4.1 `universities`

Справочник университетов.

Поля:

- `id` `bigserial pk`
- `name` `varchar(255)` not null
- `slug` `varchar(100)` unique not null
- `email_domain` `varchar(255)` unique not null
- `is_active` `boolean` default `true`
- `created_at` `timestamptz` not null

### 4.2 `dormitories`

Общежития университета.

Поля:

- `id` `bigserial pk`
- `university_id` `bigint fk -> universities.id`
- `name` `varchar(255)` not null
- `code` `varchar(50)` null
- `address` `varchar(255)` null
- `is_active` `boolean` default `true`
- `created_at` `timestamptz` not null

Индексы:

- unique (`university_id`, `name`)

### 4.3 `users`

Основной профиль пользователя.

Поля:

- `id` `bigserial pk`
- `email` `varchar(255)` unique not null
- `email_verified_at` `timestamptz` null
- `full_name` `varchar(255)` not null
- `avatar_url` `text` null
- `role` `varchar(30)` default `student`
- `university_id` `bigint fk -> universities.id`
- `dormitory_id` `bigint fk -> dormitories.id`
- `room_label` `varchar(50)` null
- `bio` `text` null
- `rating_avg` `numeric(3,2)` default `0`
- `reviews_count` `integer` default `0`
- `completed_tasks_count` `integer` default `0`
- `created_tasks_count` `integer` default `0`
- `is_blocked` `boolean` default `false`
- `created_at` `timestamptz` not null
- `updated_at` `timestamptz` not null

Примечание: агрегаты можно хранить денормализованно и пересчитывать после завершения задач/отзывов.

### 4.4 `user_sessions`

Сессии после логина.

Поля:

- `id` `uuid pk`
- `user_id` `bigint fk -> users.id`
- `refresh_token_hash` `varchar(255)` not null
- `user_agent` `text` null
- `ip` `inet` null
- `expires_at` `timestamptz` not null
- `revoked_at` `timestamptz` null
- `created_at` `timestamptz` not null

### 4.5 `email_verification_codes`

Коды/токены подтверждения email для MVP авторизации.

Поля:

- `id` `uuid pk`
- `email` `varchar(255)` not null
- `code_hash` `varchar(255)` not null
- `university_id` `bigint fk -> universities.id`
- `expires_at` `timestamptz` not null
- `used_at` `timestamptz` null
- `created_at` `timestamptz` not null

### 4.6 `tasks`

Основная заявка.

Поля:

- `id` `bigserial pk`
- `customer_id` `bigint fk -> users.id`
- `university_id` `bigint fk -> universities.id`
- `dormitory_id` `bigint fk -> dormitories.id`
- `title` `varchar(255)` not null
- `description` `text` not null
- `category` `varchar(50)` not null
- `urgency` `varchar(30)` not null
- `payment_type` `varchar(30)` not null
- `price_amount` `integer` null
- `barter_description` `text` null
- `currency` `varchar(10)` default `'RUB'`
- `visibility` `varchar(20)` not null
- `status` `varchar(30)` not null
- `accepted_offer_id` `bigint` null
- `offers_count` `integer` default `0`
- `published_at` `timestamptz` not null
- `starts_at` `timestamptz` null
- `completed_at` `timestamptz` null
- `cancelled_at` `timestamptz` null
- `cancellation_reason` `text` null
- `created_at` `timestamptz` not null
- `updated_at` `timestamptz` not null

Индексы:

- `university_id, status, created_at desc`
- `dormitory_id, status, created_at desc`
- `customer_id, created_at desc`
- `category, status`

Рекомендуемые `check constraint`:

- `payment_type = 'fixed_price'` => `price_amount is not null and price_amount > 0 and barter_description is null`
- `payment_type = 'negotiable'` => `price_amount is null and barter_description is null`
- `payment_type = 'barter'` => `price_amount is null and barter_description is not null`

Примечание: `accepted_offer_id` добавляется после создания таблицы `task_offers`.

### 4.7 `task_offers`

Отклики на заявку.

Поля:

- `id` `bigserial pk`
- `task_id` `bigint fk -> tasks.id`
- `performer_id` `bigint fk -> users.id`
- `message` `text` not null
- `price_amount` `integer` null
- `payment_type` `varchar(30)` not null
- `barter_description` `text` null
- `status` `varchar(20)` not null
- `created_at` `timestamptz` not null
- `updated_at` `timestamptz` not null

Индексы:

- unique (`task_id`, `performer_id`) для MVP один активный отклик от пользователя на задачу
- `performer_id, created_at desc`
- `task_id, status`

Рекомендуемые `check constraint`:

- `payment_type = 'fixed_price'` => `price_amount is not null and price_amount > 0 and barter_description is null`
- `payment_type = 'negotiable'` => `price_amount is null and barter_description is null`
- `payment_type = 'barter'` => `price_amount is null and barter_description is not null`

### 4.7.1 `offer_counter_offers`

История согласования условий по конкретному отклику до выбора исполнителя.

Поля:

- `id` `bigserial pk`
- `offer_id` `bigint fk -> task_offers.id`
- `author_user_id` `bigint fk -> users.id`
- `message` `text` null
- `price_amount` `integer` null
- `payment_type` `varchar(30)` not null
- `barter_description` `text` null
- `status` `varchar(20)` not null
- `created_at` `timestamptz` not null
- `updated_at` `timestamptz` not null

Статусы:

- `pending`
- `accepted`
- `rejected`
- `superseded`

Правила:

- counter-offer может создать только заказчик задачи или автор отклика;
- одновременно у одного `offer` допускается только один активный `pending counter_offer`;
- после принятия одного варианта остальные `pending` переводятся в `superseded`;
- после `offers.status = accepted` новые counter-offer запрещены.

Рекомендуемые `check constraint`:

- `payment_type = 'fixed_price'` => `price_amount is not null and price_amount > 0 and barter_description is null`
- `payment_type = 'negotiable'` => `price_amount is null and barter_description is null`
- `payment_type = 'barter'` => `price_amount is null and barter_description is not null`

### 4.8 `task_assignments`

Фиксация выбранного исполнителя и жизненного цикла работы.

Поля:

- `id` `bigserial pk`
- `task_id` `bigint fk -> tasks.id unique`
- `offer_id` `bigint fk -> task_offers.id unique`
- `customer_id` `bigint fk -> users.id`
- `performer_id` `bigint fk -> users.id`
- `agreed_price_amount` `integer` null
- `agreed_payment_type` `varchar(30)` not null
- `agreed_barter_description` `text` null
- `status` `varchar(30)` not null
- `assigned_at` `timestamptz` not null
- `started_at` `timestamptz` null
- `completed_at` `timestamptz` null
- `cancelled_at` `timestamptz` null
- `created_at` `timestamptz` not null
- `updated_at` `timestamptz` not null

Почему отдельная таблица: проще хранить историю выбора исполнителя и не перегружать `tasks`.

Рекомендуемые `check constraint`:

- `agreed_payment_type = 'fixed_price'` => `agreed_price_amount is not null and agreed_price_amount > 0 and agreed_barter_description is null`
- `agreed_payment_type = 'negotiable'` использовать нельзя, к моменту назначения условия уже должны быть зафиксированы
- `agreed_payment_type = 'barter'` => `agreed_price_amount is null and agreed_barter_description is not null`

### 4.9 `task_completion_confirmations`

Подтверждения выполнения.

Поля:

- `id` `bigserial pk`
- `task_assignment_id` `bigint fk -> task_assignments.id unique`
- `customer_confirmed_at` `timestamptz` null
- `performer_confirmed_at` `timestamptz` null
- `status` `varchar(30)` not null
- `dispute_opened_by_user_id` `bigint fk -> users.id null`
- `dispute_comment` `text` null
- `created_at` `timestamptz` not null
- `updated_at` `timestamptz` not null

### 4.10 `task_chats`

Чат по заявке.

Поля:

- `id` `bigserial pk`
- `task_id` `bigint fk -> tasks.id unique`
- `customer_id` `bigint fk -> users.id`
- `performer_id` `bigint fk -> users.id`
- `created_at` `timestamptz` not null
- `updated_at` `timestamptz` not null

Примечание: в текущей версии чат создаётся только после выбора исполнителя, поэтому `performer_id` обязателен.

### 4.11 `chat_messages`

Сообщения в чате.

Поля:

- `id` `bigserial pk`
- `chat_id` `bigint fk -> task_chats.id`
- `sender_id` `bigint fk -> users.id`
- `message_type` `varchar(20)` default `'text'`
- `body` `text` not null
- `read_at` `timestamptz` null
- `created_at` `timestamptz` not null

Индексы:

- `chat_id, created_at`
- `sender_id, created_at`

### 4.12 `reviews`

Отзыв после завершения.

Поля:

- `id` `bigserial pk`
- `task_id` `bigint fk -> tasks.id`
- `task_assignment_id` `bigint fk -> task_assignments.id`
- `author_id` `bigint fk -> users.id`
- `target_user_id` `bigint fk -> users.id`
- `rating` `smallint` not null
- `comment` `text` null
- `is_visible` `boolean` default `true`
- `moderation_status` `varchar(20)` default `'pending'`
- `created_at` `timestamptz` not null
- `updated_at` `timestamptz` not null

Ограничения:

- unique (`task_assignment_id`, `author_id`) — один отзыв от каждой стороны
- `rating` check between 1 and 5

### 4.13 `notifications`

Автоматические пользовательские уведомления внутри сервиса.

Поля:

- `id` `bigserial pk`
- `user_id` `bigint fk -> users.id`
- `type` `varchar(50)` not null
- `title` `varchar(255)` not null
- `body` `text` not null
- `entity_type` `varchar(50)` null
- `entity_id` `bigint` null
- `payload` `jsonb` null
- `is_read` `boolean` default `false`
- `read_at` `timestamptz` null
- `created_at` `timestamptz` not null

Индексы:

- `user_id, is_read, created_at desc`
- `user_id, created_at desc`

Типы уведомлений для MVP:

- `offer_received`
- `offer_rejected`
- `offer_accepted`
- `counter_offer_received`
- `counter_offer_accepted`
- `counter_offer_rejected`
- `chat_message_received`
- `task_completed_requested`
- `task_completed_confirmed`
- `task_disputed`
- `review_received`
- `report_resolved`

### 4.14 `notification_preferences`

Настройки каналов и типов уведомлений.

Поля:

- `id` `bigserial pk`
- `user_id` `bigint fk -> users.id unique`
- `in_app_enabled` `boolean` default `true`
- `web_push_enabled` `boolean` default `true`
- `offers_enabled` `boolean` default `true`
- `counter_offers_enabled` `boolean` default `true`
- `chat_enabled` `boolean` default `true`
- `task_updates_enabled` `boolean` default `true`
- `reviews_enabled` `boolean` default `true`
- `moderation_enabled` `boolean` default `true`
- `created_at` `timestamptz` not null
- `updated_at` `timestamptz` not null

### 4.15 `web_push_subscriptions`

Подписки браузера или PWA на push-уведомления.

Поля:

- `id` `bigserial pk`
- `user_id` `bigint fk -> users.id`
- `endpoint` `text` not null
- `p256dh_key` `text` not null
- `auth_key` `text` not null
- `user_agent` `text` null
- `is_active` `boolean` default `true`
- `last_used_at` `timestamptz` null
- `created_at` `timestamptz` not null
- `updated_at` `timestamptz` not null

Индексы:

- unique (`user_id`, `endpoint`)

### 4.16 `reports`

Жалобы на пользователя, задачу, отзыв или сообщение.

Поля:

- `id` `bigserial pk`
- `reporter_id` `bigint fk -> users.id`
- `target_type` `varchar(30)` not null
- `target_id` `bigint` not null
- `reason_code` `varchar(50)` not null
- `comment` `text` null
- `status` `varchar(20)` not null
- `resolved_by_user_id` `bigint fk -> users.id null`
- `resolved_at` `timestamptz` null
- `created_at` `timestamptz` not null

### 4.17 `audit_logs`

Минимальный аудит чувствительных действий.

Поля:

- `id` `bigserial pk`
- `actor_user_id` `bigint fk -> users.id null`
- `entity_type` `varchar(50)` not null
- `entity_id` `bigint` not null
- `action` `varchar(50)` not null
- `payload` `jsonb` null
- `created_at` `timestamptz` not null

## 5. Связи между сущностями

- один `university` имеет много `dormitories`;
- один `user` принадлежит одному `university` и опционально одному `dormitory`;
- один `user` создаёт много `tasks`;
- одна `task` имеет много `task_offers`;
- один `task_offer` может иметь много `offer_counter_offers`;
- одна `task` имеет максимум один `task_assignment`;
- один `task_assignment` имеет одну запись `task_completion_confirmations`;
- одна `task` имеет максимум один `task_chats`;
- один `task_chat` имеет много `chat_messages`;
- один `user` имеет много `notifications`;
- один `user` имеет одну запись `notification_preferences`;
- один `user` может иметь много `web_push_subscriptions`;
- один `task_assignment` может иметь максимум два `reviews` — от заказчика и исполнителя.

## 6. Рекомендации по ограничениям БД

- все timestamps хранить как `timestamptz`;
- все статусы и типы валидировать `check constraint` или PostgreSQL enum;
- на `tasks`, `task_offers`, `offer_counter_offers`, `chat_messages`, `notifications`, `reviews`, `reports` обязательно `created_at desc` индексы;
- soft delete для MVP не нужен, достаточно `status` и `is_visible`;
- удаление пользователей физически не делать, только блокировка.

### Денежные и barter-ограничения

Одинаковую логику лучше продублировать и в API-валидации, и в БД:

- `fixed_price` — цена обязательна, barter-описание запрещено;
- `negotiable` — и цена, и barter-описание должны быть `null`;
- `barter` — barter-описание обязательно, цена запрещена;
- в `task_assignments` нельзя оставлять `agreed_payment_type = negotiable`, потому что к моменту выбора исполнителя условия уже должны быть согласованы;
- для денежных сумм стоит добавить `check (price_amount > 0)` и `check (agreed_price_amount > 0)` там, где поле не `null`.

## 7. API conventions

### Base URL

- `/api/v1`

### Auth

- access token в `Authorization: Bearer <token>`
- refresh token хранить в httpOnly cookie или отдельным токеном для mobile/web

### Общая форма ошибок

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid request payload",
    "details": {
      "field": "title"
    }
  }
}
```

### Пагинация

Cursor-based либо `limit/offset`. Для MVP достаточно:

- `limit`
- `offset`
- `total` в ответе

## 8. API: Auth и onboarding

### `POST /auth/email/request-code`

Запрос кода подтверждения на университетскую почту.

Request:

```json
{
  "email": "student@university.edu"
}
```

Response `200`:

```json
{
  "status": "code_sent",
  "expires_in_sec": 600
}
```

Правила:

- email domain должен существовать в `universities.email_domain`;
- rate limit обязателен.

### `POST /auth/email/verify-code`

Подтверждение кода и первичный логин.

Request:

```json
{
  "email": "student@university.edu",
  "code": "123456"
}
```

Response `200`:

```json
{
  "access_token": "jwt",
  "refresh_token": "opaque-or-jwt",
  "user": {
    "id": 12,
    "email": "student@university.edu",
    "full_name": "Иван Петров",
    "role": "student",
    "university": {
      "id": 2,
      "name": "МГТУ"
    },
    "dormitory": null,
    "profile_completed": false
  }
}
```

### `POST /auth/refresh`

Обновление access token.

### `POST /auth/logout`

Инвалидация refresh session.

### `GET /me`

Текущий пользователь.

### `PATCH /me`

Заполнение профиля после первого входа.

Request:

```json
{
  "full_name": "Иван Петров",
  "dormitory_id": 7,
  "room_label": "512",
  "bio": "Помогаю с доставкой и мелким ремонтом"
}
```

### `GET /reference/dormitories`

Список общежитий текущего университета.

## 9. API: Пользователи и профиль

### `GET /users/{user_id}`

Публичный профиль.

Response `200`:

```json
{
  "id": 44,
  "full_name": "Алексей Михайлов",
  "avatar_url": null,
  "dormitory": {
    "id": 7,
    "name": "Общежитие №4"
  },
  "rating_avg": 4.8,
  "reviews_count": 24,
  "completed_tasks_count": 32,
  "created_tasks_count": 11,
  "badges": [
    "verified_student",
    "fast_responder"
  ]
}
```

### `GET /users/{user_id}/reviews`

Список видимых отзывов о пользователе.

### `GET /users/{user_id}/tasks?role=customer|performer&status=active|completed|cancelled`

История задач пользователя.

## 10. API: Лента и задачи

### `GET /tasks`

Лента по университету и общежитиям.

По умолчанию пользователь видит заявки из всех общежитий своего университета. Фильтр `scope=dormitory` нужен только если пользователь хочет сузить ленту до своего или выбранного общежития.

Поддерживаемые query params:

- `scope=university|dormitory`
- `dormitory_id`
- `category`
- `status`
- `urgency`
- `payment_type`
- `search`
- `limit`
- `offset`

Response `200`:

```json
{
  "items": [
    {
      "id": 101,
      "title": "Помочь перенести мебель",
      "description": "Нужно перенести стол и два стула",
      "category": "moving",
      "urgency": "urgent",
      "payment_type": "fixed_price",
      "price_amount": 800,
      "status": "offers",
      "visibility": "university",
      "offers_count": 3,
      "created_at": "2026-03-21T10:00:00Z",
      "customer": {
        "id": 44,
        "full_name": "Алексей Михайлов",
        "rating_avg": 4.8
      },
      "university": {
        "id": 2,
        "name": "МГТУ"
      },
      "dormitory": {
        "id": 7,
        "name": "Общежитие №4"
      }
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### `POST /tasks`

Создание заявки.

Request:

```json
{
  "title": "Помочь перенести мебель с 3 на 7 этаж",
  "description": "Нужна помощь с переносом стола и двух стульев",
  "category": "moving",
  "urgency": "urgent",
  "payment_type": "fixed_price",
  "price_amount": 800,
  "barter_description": null,
  "visibility": "university",
  "dormitory_id": 7
}
```

Правила:

- `price_amount` обязателен для `fixed_price`;
- `price_amount` должен быть `null` для `negotiable` и `barter`;
- `barter_description` обязателен для `barter`;
- `barter_description` должен быть `null` для `fixed_price`;
- автор может создать задачу только в рамках своего `university`;
- по умолчанию `status = open`.

### `GET /tasks/{task_id}`

Детальная карточка задачи.

В ответ стоит возвращать:

- саму задачу;
- автора;
- число откликов;
- accepted offer, если есть;
- признак, может ли текущий пользователь откликнуться;
- признак, может ли текущий пользователь выбрать исполнителя;
- краткую аналитику по категории, если она уже есть.

### `PATCH /tasks/{task_id}`

Редактирование задачи до выбора исполнителя.

Редактируемые поля:

- `title`
- `description`
- `category`
- `urgency`
- `payment_type`
- `price_amount`
- `barter_description`
- `visibility`
- `dormitory_id`

Ограничения:

- только автор;
- нельзя редактировать при `status in ('in_progress', 'completed', 'cancelled')`.

### `POST /tasks/{task_id}/cancel`

Отмена задачи автором.

Request:

```json
{
  "reason": "Уже не актуально"
}
```

### `GET /me/tasks`

Мои задачи.

Query params:

- `role=customer|performer`
- `status=active|completed|cancelled`

## 11. API: Отклики

### `GET /tasks/{task_id}/offers`

Список откликов по задаче.

Правила доступа:

- автор задачи видит все отклики;
- исполнитель видит только свой отклик;
- moderator/admin видят все.

### `POST /tasks/{task_id}/offers`

Откликнуться на задачу.

Request:

```json
{
  "message": "Могу помочь сегодня после 18:00",
  "price_amount": 900,
  "payment_type": "fixed_price",
  "barter_description": null
}
```

Правила:

- нельзя откликаться на собственную задачу;
- нельзя откликаться, если задача не в `open` или `offers`;
- повторный активный отклик запрещён.
- для `barter` в отклике обязательно передать `barter_description`.

Если это первый отклик, у задачи меняется `status` на `offers`.

### `PATCH /offers/{offer_id}`

Редактирование своего отклика до выбора исполнителя.

### `GET /offers/{offer_id}/counter-offers`

История переговоров по отклику.

### `POST /offers/{offer_id}/counter-offers`

Контрпредложение по условиям отклика.

Request:

```json
{
  "message": "Смогу сделать за 700 рублей",
  "payment_type": "fixed_price",
  "price_amount": 700,
  "barter_description": null
}
```

Пример barter-варианта:

```json
{
  "message": "Могу помочь с переносом, если потом поможешь с печатью конспектов",
  "payment_type": "barter",
  "price_amount": null,
  "barter_description": "Взамен нужна помощь с печатью 120 страниц"
}
```

Правила:

- counter-offer могут создавать только заказчик и автор отклика;
- новый counter-offer можно создать только если нет другого активного `pending`;
- `price_amount` обязателен для `fixed_price`;
- `barter_description` обязателен для `barter`;
- если создаётся новый раунд переговоров, предыдущий `pending` получает `superseded`.

### `POST /counter-offers/{counter_offer_id}/accept`

Принять актуальное контрпредложение.

Эффект:

- `counter_offer.status = accepted`;
- согласованные условия становятся финальными условиями отклика;
- после этого заказчик может вызвать `POST /offers/{offer_id}/accept`.

### `POST /counter-offers/{counter_offer_id}/reject`

Отклонить контрпредложение.

Эффект:

- `counter_offer.status = rejected`;
- переговоры по этому раунду завершаются без изменения текущих условий отклика.

### `POST /offers/{offer_id}/withdraw`

Исполнитель отзывает свой отклик.

### `POST /offers/{offer_id}/accept`

Заказчик выбирает исполнителя.

Эффект:

- `offers.status = accepted` для выбранного;
- остальные активные отклики получают `rejected`;
- создаётся `task_assignments`;
- создаётся `task_chats`;
- `tasks.status = in_progress`;
- `tasks.accepted_offer_id` обновляется.

Если по отклику был принят `counter_offer`, в `task_assignments` переносятся уже согласованные условия, включая barter.

Response `200`:

```json
{
  "task_id": 101,
  "assignment_id": 501,
  "chat_id": 301,
  "status": "in_progress"
}
```

### `POST /offers/{offer_id}/reject`

Ручное отклонение конкретного отклика без выбора исполнителя.

## 12. API: Чат

Чат в этой версии открывается только после выбора исполнителя. До этого согласование условий идёт через `offer_counter_offers`.

### `GET /chats`

Список чатов текущего пользователя.

### `GET /chats/{chat_id}`

Метаданные чата и участники.

### `GET /chats/{chat_id}/messages`

Список сообщений.

Query params:

- `limit`
- `before_message_id`

### `POST /chats/{chat_id}/messages`

Отправка сообщения.

Request:

```json
{
  "body": "Привет, могу подойти через 20 минут"
}
```

### `POST /chats/{chat_id}/read`

Пометка всех сообщений как прочитанных для текущего пользователя.

Для realtime:

- `GET /ws/chats/{chat_id}`

Для чатов websocket желателен, но если нужно упрощение первой версии, можно временно оставить REST + polling.

## 13. API: Завершение и подтверждение

### `POST /tasks/{task_id}/complete-request`

Одна из сторон инициирует завершение задачи.

Логика:

- если задача в `in_progress`, создаётся или обновляется запись в `task_completion_confirmations`;
- фиксируется, кто подтвердил первым.

Response `200`:

```json
{
  "task_id": 101,
  "confirmation_status": "customer_confirmed"
}
```

### `POST /tasks/{task_id}/confirm-completion`

Вторая сторона подтверждает выполнение.

Эффект:

- `task_completion_confirmations.status = completed`;
- `task_assignments.status = completed`;
- `tasks.status = completed`;
- `tasks.completed_at` выставляется;
- пользователям позже открывается возможность оставить отзывы.

### `POST /tasks/{task_id}/open-dispute`

Открыть спор вместо подтверждения.

Request:

```json
{
  "comment": "Исполнитель не выполнил задачу полностью"
}
```

Эффект:

- `task_completion_confirmations.status = disputed`;
- создаётся `report`.

## 14. API: Уведомления

Уведомления должны создаваться автоматически сервером при доменных событиях и попадать пользователю:

- в in-app колокольчик;
- в realtime stream для открытой веб-сессии;
- в browser push, если пользователь дал разрешение и сохранил subscription.

### События, которые создают уведомления

- новый отклик на мою задачу;
- мой отклик приняли;
- мой отклик отклонили;
- пришло контрпредложение;
- контрпредложение приняли или отклонили;
- новое сообщение в чате;
- другая сторона запросила завершение задачи;
- задача завершена;
- открыт спор по задаче;
- мне оставили отзыв;
- модератор обработал мою жалобу.

### `GET /notifications`

Список уведомлений текущего пользователя.

Query params:

- `status=all|unread`
- `limit`
- `offset`

Response `200`:

```json
{
  "items": [
    {
      "id": 701,
      "type": "offer_received",
      "title": "Новый отклик на заявку",
      "body": "Мария К. предложила помочь с переносом мебели",
      "entity_type": "task",
      "entity_id": 101,
      "payload": {
        "task_id": 101,
        "offer_id": 901
      },
      "is_read": false,
      "created_at": "2026-03-21T10:15:00Z"
    }
  ],
  "unread_count": 4,
  "limit": 20,
  "offset": 0
}
```

### `GET /notifications/unread-count`

Счётчик непрочитанных уведомлений для колокольчика.

### `POST /notifications/{notification_id}/read`

Пометить уведомление как прочитанное.

### `POST /notifications/read-all`

Пометить все уведомления текущего пользователя как прочитанные.

### `GET /me/notification-preferences`

Текущие настройки уведомлений.

### `PATCH /me/notification-preferences`

Изменение настроек уведомлений.

Request:

```json
{
  "in_app_enabled": true,
  "web_push_enabled": true,
  "offers_enabled": true,
  "counter_offers_enabled": true,
  "chat_enabled": true,
  "task_updates_enabled": true,
  "reviews_enabled": true,
  "moderation_enabled": true
}
```

### `POST /me/web-push-subscriptions`

Сохранить browser push subscription.

Request:

```json
{
  "endpoint": "https://push.example/subscription/123",
  "p256dh_key": "base64",
  "auth_key": "base64"
}
```

### `DELETE /me/web-push-subscriptions/{subscription_id}`

Удалить push subscription, например при logout или отзыве разрешения браузера.

### `GET /ws/notifications`

Realtime канал уведомлений для текущего пользователя.

Сервер отправляет событие при создании новой записи в `notifications`.

Payload события:

```json
{
  "event": "notification_created",
  "notification": {
    "id": 701,
    "type": "chat_message_received",
    "title": "Новое сообщение",
    "body": "Исполнитель написал в чате",
    "entity_type": "chat",
    "entity_id": 301,
    "payload": {
      "chat_id": 301,
      "task_id": 101
    },
    "is_read": false,
    "created_at": "2026-03-21T11:00:00Z"
  },
  "unread_count": 5
}
```

Примечание:

- если websocket не подключён, пользователь всё равно видит уведомления через `GET /notifications`;
- browser push отправляется только при наличии активной `web_push_subscription`;
- создание уведомлений должно происходить асинхронно после доменного события, чтобы не тормозить основной request.

## 15. API: Отзывы и рейтинг

### `GET /tasks/{task_id}/reviews`

Отзывы по завершённой задаче.

### `POST /tasks/{task_id}/reviews`

Оставить отзыв второй стороне.

Request:

```json
{
  "rating": 5,
  "comment": "Всё было быстро и аккуратно"
}
```

Правила:

- только участник завершённой задачи;
- только после `tasks.status = completed`;
- только один отзыв от автора на другого участника.

### `PATCH /reviews/{review_id}`

Редактирование отзыва в течение короткого окна, например 15 минут.

### `POST /reviews/{review_id}/report`

Жалоба на отзыв.

## 16. API: Жалобы и модерация

### `POST /reports`

Универсальная жалоба.

Request:

```json
{
  "target_type": "task",
  "target_id": 101,
  "reason_code": "spam",
  "comment": "Подозрительное объявление"
}
```

### `GET /moderation/reports`

Список жалоб для модератора.

### `POST /moderation/reports/{report_id}/resolve`

Закрытие жалобы.

Request:

```json
{
  "resolution": "rejected",
  "comment": "Нарушений не найдено"
}
```

### `GET /moderation/reviews`

Проверка отзывов со статусом `pending`.

### `POST /moderation/reviews/{review_id}/approve`

Публикация отзыва.

### `POST /moderation/reviews/{review_id}/hide`

Скрытие отзыва.

## 17. API: Аналитика

Не критично для первого backend-итерационного релиза, но UI уже предполагает аналитику категории.

### `GET /analytics/categories/{category}`

Response:

```json
{
  "category": "moving",
  "completed_tasks_count": 89,
  "avg_price_amount": 420,
  "median_price_amount": 380,
  "min_price_amount": 150,
  "max_price_amount": 1200,
  "avg_completion_minutes": 150,
  "price_histogram": [
    { "range": "0-200", "count": 12 },
    { "range": "200-400", "count": 28 }
  ]
}
```

Источник данных:

- либо runtime aggregation по завершённым задачам;
- либо materialized view/cron table позже.

## 18. Минимальный набор ответов DTO

### `TaskShort`

```json
{
  "id": 101,
  "title": "Помочь перенести мебель",
  "category": "moving",
  "urgency": "urgent",
  "payment_type": "fixed_price",
  "price_amount": 800,
  "status": "offers",
  "offers_count": 3,
  "created_at": "2026-03-21T10:00:00Z"
}
```

### `Offer`

```json
{
  "id": 901,
  "task_id": 101,
  "performer": {
    "id": 55,
    "full_name": "Мария К.",
    "rating_avg": 4.9,
    "completed_tasks_count": 18
  },
  "message": "Готова помочь сегодня вечером",
  "price_amount": 850,
  "payment_type": "fixed_price",
  "barter_description": null,
  "status": "pending",
  "created_at": "2026-03-21T10:15:00Z"
}
```

### `CounterOffer`

```json
{
  "id": 1001,
  "offer_id": 901,
  "author_user_id": 44,
  "message": "Сделаем за 700 или за помощь с распечаткой?",
  "payment_type": "barter",
  "price_amount": null,
  "barter_description": "Взамен нужна печать 120 страниц",
  "status": "pending",
  "created_at": "2026-03-21T10:20:00Z"
}
```

### `ChatMessage`

```json
{
  "id": 801,
  "chat_id": 301,
  "sender_id": 44,
  "message_type": "text",
  "body": "Подходите к 19:00",
  "created_at": "2026-03-21T11:00:00Z",
  "read_at": null
}
```

### `Notification`

```json
{
  "id": 701,
  "type": "offer_received",
  "title": "Новый отклик на заявку",
  "body": "Мария К. предложила свои условия",
  "entity_type": "task",
  "entity_id": 101,
  "payload": {
    "task_id": 101,
    "offer_id": 901
  },
  "is_read": false,
  "created_at": "2026-03-21T10:15:00Z"
}
```

## 19. Что внедрять первым

Если идти по этапам backend-разработки, разумный порядок такой:

1. `universities`, `dormitories`, `users`, `email_verification_codes`, `user_sessions`
2. `tasks`
3. `task_offers`
4. `offer_counter_offers`
5. `task_assignments`
6. `notifications`, `notification_preferences`, `web_push_subscriptions`
7. `task_chats`, `chat_messages`
8. `task_completion_confirmations`
9. `reviews`
10. `reports`, `audit_logs`

## 20. Что можно упростить ещё сильнее

Если нужен совсем жёсткий MVP на 1 спринт, можно временно:

- модель уже упрощена до `university` + `dormitory`, отдельная промежуточная сущность не нужна;
- убрать `task_assignments` и хранить `performer_id` прямо в `tasks`;
- временно оставить только `notifications` без `web_push_subscriptions`, если хватит колокольчика и websocket;
- не делать отдельную модерацию отзывов, только `reports`;
- не делать `audit_logs` в первой версии.

Но текущая схема выше лучше масштабируется и при этом остаётся достаточно простой для FastAPI + PostgreSQL.
