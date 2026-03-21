# План интеграции Frontend с API (без изменений backend)

## 1. Цель
Подключить текущий `frontend/` к API из `docs/API.md` без изменения визуального стиля сайта и без правок backend, двигаясь итеративно до полного покрытия текущего UI.

## 2. Зафиксированные договорённости
- Работаем строго по контракту `docs/API.md`.
- Базовый URL API: `http://localhost:3000/api/v1` (вынести в `VITE_API_BASE_URL`).
- Backend не меняем.
- Интеграция итеративная, не обязательно за один проход.
- В первой итерации делаем: `Auth + Onboarding + Лента + Создание задачи + Детальная + Отклики + Уведомления (REST) + Чаты (REST/polling)`.
- Для UX при недоступных endpoint: не падать, показывать `loading/empty/error + retry + toast`.
- Профиль (`/profile`) пока остаётся на моках.
- Аналитика (`/analytics`) пока не трогаем.
- Сообщения пользователю в задаче отправляются только через чат после назначения исполнителя.
- Реальный email-код планируется использовать, но сейчас может быть не реализован на backend: фронт должен корректно обрабатывать это.

## 3. Ограничения по дизайну
- Сохраняем текущий визуальный стиль, сетку, типографику и поведение существующих экранов.
- Разрешены минимальные UI-добавления для продукта: экраны входа/onboarding, состояния загрузки/ошибок/пустых данных, retry-действия.
- Изменения интерфейса только функциональные, без редизайна.

## 4. Технический подход
1. Добавить единый API-слой:
   - `api/client` (fetch-обёртка, базовый URL, таймауты, парсинг ошибок).
   - `api/types` (DTO по `API.md`).
   - `api/services/*` (auth, tasks, offers, chats, notifications, reference).
2. Централизовать auth-сессию:
   - хранение `access_token`/`refresh_token`;
   - авто-refresh и повтор запроса при `401`;
   - logout с очисткой сессии.
3. Использовать `@tanstack/react-query` для загрузки/мутаций/кеша/инвалидаций.
4. Сохранить существующие компоненты и CSS-классы; менять в основном источники данных и обработчики действий.

## 5. Итерации

## 5.1 Итерация 1 (основной объём)
### A. Инфраструктура и каркас API
- Добавить env-конфиг для `VITE_API_BASE_URL`.
- Реализовать `ApiError` и нормализацию ошибок формата из `API.md`.
- Реализовать query/mutation-хелперы и ключи кэша.

### B. Auth + Onboarding
- Добавить экран входа:
  - `POST /auth/email/request-code`;
  - `POST /auth/email/verify-code`.
- Добавить bootstrap сессии:
  - `POST /auth/refresh`;
  - `POST /auth/logout`;
  - `GET /me`.
- Добавить onboarding профиля:
  - `PATCH /me`;
  - `GET /reference/dormitories`.
- Добавить route guard:
  - без сессии пользователь видит только auth-flow;
  - после логина — текущие страницы приложения.

### C. Лента и создание задач
- Заменить локальные/моковые данные для `/` на API:
  - `GET /tasks` с фильтрами (`category`, `scope`, `dormitory_id`, `status`, `urgency`, `payment_type`, `search`, `limit`, `offset`);
  - `POST /tasks` из модалки создания.
- Оставить текущую визуальную структуру карточек и фильтров.
- Добавить состояния: skeleton, empty, error (с retry).

### D. Детальная задачи и отклики
- Подключить:
  - `GET /tasks/{task_id}`;
  - `GET /tasks/{task_id}/offers`;
  - `POST /tasks/{task_id}/offers`;
  - `PATCH /offers/{offer_id}`;
  - `POST /offers/{offer_id}/withdraw`.
- Привязка текущих действий:
  - «Предложить услугу/цену» -> создание отклика;
  - «Написать» доступно только при наличии чата (после назначения).
- Локальные interaction-данные на этой странице поэтапно заменить серверными.

### E. Уведомления (REST)
- Подключить:
  - `GET /notifications`;
  - `GET /notifications/unread-count`;
  - `POST /notifications/{notification_id}/read`;
  - `POST /notifications/read-all`.
- Подключить существующий popover к API-данным.
- Локальный storage уведомлений отключить для интегрированных событий.

### F. Чаты (REST + polling, без websocket)
- Подключить:
  - `GET /chats`;
  - `GET /chats/{chat_id}`;
  - `GET /chats/{chat_id}/messages`;
  - `POST /chats/{chat_id}/messages`;
  - `POST /chats/{chat_id}/read`.
- Реализовать polling для обновления сообщений и счётчиков.
- UI-чата встраивать без редизайна, минимально-инвазивно в текущую структуру экранов.

### G. Что не входит в итерацию 1
- `/profile` API-интеграция.
- `/analytics` API-интеграция.
- websocket (`/ws/chats/*`, `/ws/notifications`).
- moderation/reports/reviews как полноценный поток.

## 5.2 Итерация 2
- Counter-offers:
  - `GET /offers/{offer_id}/counter-offers`;
  - `POST /offers/{offer_id}/counter-offers`;
  - `POST /counter-offers/{counter_offer_id}/accept`;
  - `POST /counter-offers/{counter_offer_id}/reject`.
- Выбор исполнителя и lifecycle задачи:
  - `POST /offers/{offer_id}/accept`;
  - `POST /offers/{offer_id}/reject`;
  - `POST /tasks/{task_id}/cancel`;
  - `POST /tasks/{task_id}/complete-request`;
  - `POST /tasks/{task_id}/confirm-completion`;
  - `POST /tasks/{task_id}/open-dispute`.

## 5.3 Итерация 3
- Интеграция профиля с API:
  - `GET /users/{user_id}`;
  - `GET /users/{user_id}/tasks`;
  - `GET /users/{user_id}/reviews`;
  - `GET /me/tasks`.
- Интеграция аналитики:
  - `GET /analytics/categories/{category}`.

## 6. UX-правила для нестабильного backend
- Любая ошибка endpoint:
  - понятный текст для пользователя;
  - кнопка повтора;
  - сохранение работоспособности страницы.
- Для мутаций:
  - блокировка кнопки на время запроса;
  - toast на успех/ошибку;
  - корректная инвалидация query-кеша.
- Если часть API временно не реализована:
  - не подмешивать моки в уже интегрированных разделах;
  - показывать controlled empty/error states.

## 7. Критерии готовности итерации 1
- Пользователь может пройти auth-flow и onboarding без падений UI.
- Лента загружается из API, фильтры работают, создание задачи отправляется в API.
- Детальная задачи грузится из API; отклик можно создать и увидеть в UI.
- Уведомления в поповере работают через REST.
- Чат после назначения исполнителя открывается и отправляет сообщения через REST.
- Дизайн текущего сайта сохранён (без редизайна).

## 8. Риски и смягчение
- Риск: backend не реализует часть контрактов из `API.md`.
  - Смягчение: error/empty/retry UX и поэтапное включение фич.
- Риск: различия DTO между текущими компонентами и API.
  - Смягчение: отдельный слой мапперов `API DTO -> UI model`.
- Риск: регрессии из-за замены local storage логики.
  - Смягчение: постепенно отключать local state только после подключения конкретного API-блока.

## 9. Порядок внедрения по файлам (первый проход)
1. Добавить новые файлы: `src/api/*`, `src/auth/*`, `src/types/*`.
2. Обновить роутинг и guard в `src/App.tsx`.
3. Перевести `Index` и `CreateRequestModal` на API.
4. Перевести `TaskDetail` на API для task/offers/chat.
5. Перевести `TopNav` уведомления на API.
6. Оставить `Profile` и `Analytics` временно на моках.

## 10. Принцип выполнения
После утверждения этого плана изменения в коде делаются строго по нему, с поэтапной проверкой после каждой итерации.

## 11. Статус выполнения (обновлено: 2026-03-21)
- Итерация 1: выполнена.
  - Подключены auth/onboarding, лента, создание задачи, детальная, отклики, уведомления и чаты (REST + polling).
  - На детальной странице добавлено редактирование своего активного отклика через `PATCH /offers/{offer_id}` без изменения дизайна.
- Итерация 2: выполнена.
  - Подключены counter-offers и lifecycle действий задачи (accept/reject offer, cancel, complete-request, confirm-completion, open-dispute).
- Итерация 3: выполнена.
  - Профиль подключён к API (`/users/{id}`, `/users/{id}/tasks`, `/users/{id}/reviews`, `/me/tasks` с fallback).
  - Аналитика подключена к API (`/analytics/categories/{category}`).

### Текущая точка
- План 5.1–5.3 покрыт по коду и проверен сборкой frontend.
- Дальнейшие шаги: точечное UX-hardening и доработка edge-cases по результатам ручного тестирования.

### Выполнено в рамках UX-hardening
- `Analytics`:
  - добавлен `retry` при ошибках;
  - добавлен режим частичного отображения данных при частично недоступных категориях;
  - добавлены controlled empty-states для пустой гистограммы.
- `TaskDetail`:
  - добавлены `retry` для ошибок загрузки истории контрпредложений и сообщений в чате.
  - добавлен безопасный `markRead` без unhandled rejection при временных сбоях сети.
- `TopNav`:
  - добавлена обработка ошибок при `markRead`;
  - включён polling списка уведомлений, пока popover открыт.
- `interaction-store`:
  - удалены неиспользуемые legacy-сущности (`localTasks`, `taskInteractions`, локальные `notifications`);
  - оставлены только актуальные данные UI-состояния (`selectedDorm`).
- Фильтрация по общежитию:
  - selector в `TopNav` привязан к `GET /reference/dormitories` (с fallback-списком);
  - в ленту передаётся `dormitory_id` через query string и `GET /tasks`;
  - в модалке создания отображается общежитие пользователя из профиля, а не временный локальный фильтр.
- API client:
  - добавлен timeout запросов (`VITE_API_TIMEOUT_MS`, default 15s);
  - добавлена явная нормализация сетевых/timeout ошибок в `ApiError`;
  - refresh-сценарий не очищает токены при временных сетевых сбоях (очистка только при 401/403).
- Auth session:
  - последний успешный `GET /me` кэшируется локально;
  - при временных сбоях сети bootstrap использует кэшированного пользователя вместо принудительного logout;
  - очистка сессии и кэша происходит только при реальном auth-failure или явном logout.
- `Profile`:
  - история сделок переведена на partial-data режим;
  - при сбое только одного из источников (`completed` или `cancelled`) показываются доступные записи и `retry`;
  - выбранная запись истории безопасно сбрасывается, если после refetch она исчезла из данных.
