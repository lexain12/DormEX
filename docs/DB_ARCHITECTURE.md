# Database Architecture

Документ фиксирует итоговую реляционную схему MVP для `Campus Exchange Hub` на основе `docs/API.md`.

## 1. Контур домена

Схема делится на 4 блока:

- идентификация и принадлежность к университету;
- жизненный цикл заявки и выбор исполнителя;
- коммуникация и доверие;
- уведомления и модерация.

## 2. Таблицы и сущности

### Идентификация и принадлежность

- `universities` — университет и email-домен для автоматической привязки пользователя.
- `dormitories` — общежития внутри университета.
- `users` — профиль пользователя, роль, агрегаты рейтинга и принадлежность к университету/общежитию.
- `user_sessions` — refresh-сессии после логина.
- `email_verification_codes` — коды подтверждения университетской почты.

### Заявки и сделки

- `tasks` — заявка заказчика.
- `task_offers` — отклики исполнителей на заявку.
- `offer_counter_offers` — история согласования условий до выбора исполнителя.
- `task_assignments` — факт назначения исполнителя и зафиксированные условия сделки.
- `task_completion_confirmations` — подтверждение выполнения или открытие спора.

### Коммуникация и доверие

- `task_chats` — чат по конкретной задаче после выбора исполнителя.
- `chat_messages` — сообщения внутри чата.
- `reviews` — отзыв одной стороны о другой после завершения задачи.

### Уведомления и модерация

- `notifications` — in-app уведомления по событиям домена.
- `notification_preferences` — пользовательские настройки уведомлений.
- `web_push_subscriptions` — browser/PWA push-подписки.
- `reports` — жалобы на пользователя, задачу, отзыв или сообщение.
- `audit_logs` — аудит чувствительных действий.

## 3. Ключевые связи

- `university -> dormitories -> users`
- `users -> tasks -> task_offers -> offer_counter_offers`
- `tasks -> task_assignments -> task_completion_confirmations`
- `tasks -> task_chats -> chat_messages`
- `task_assignments -> reviews`
- `users -> notifications / notification_preferences / web_push_subscriptions / reports / audit_logs`

## 4. Ключевые инварианты

- Пользователь и задача жёстко привязаны к одному университету через внешние ключи.
- Общежитие пользователя и общежитие задачи обязаны принадлежать тому же университету.
- Для `tasks`, `task_offers`, `offer_counter_offers` и `task_assignments` зафиксированы `check constraint` для `fixed_price`, `negotiable`, `barter`.
- У одной задачи может быть только один `accepted_offer`, один `task_assignment` и один `task_chat`.
- У одного `offer` может быть только один активный `pending counter_offer`.
- У одной стороны может быть только один отзыв на конкретное назначение исполнителя.

## 5. Где это реализовано

Фактическая схема БД заведена в Liquibase:

- `backend/liquibase/changelog/db.changelog-master.yaml`
- `backend/liquibase/changelog/sql/002_rebuild_mvp_schema.sql`
