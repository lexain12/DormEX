-- =============================================================================
-- DormEX demo seed data
-- Standalone SQL — no Liquibase required.
-- Run via:  psql "$DATABASE_URL" -f db/seeds/seed.sql
--
-- All demo user passwords: demo123
-- bcrypt hash (passlib $2b$12$):
--   $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TqznmGJJsuUIWCoC7ZklfU/yR8ey
--
-- Idempotent for universities/dormitories (ON CONFLICT DO NOTHING).
-- For users/tasks inserts only if email/title does not already exist.
-- For a clean slate run db/seeds/truncate.sql first.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. University & dormitories
-- ---------------------------------------------------------------------------
INSERT INTO universities (name, slug, email_domain, is_active)
VALUES ('МФТИ', 'mipt', 'phystech.edu', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO dormitories (university_id, name, code, address, is_active)
SELECT id, 'Общежитие №1', 'D1', 'МФТИ кампус, Общежитие №1', TRUE FROM universities WHERE slug = 'mipt'
ON CONFLICT (university_id, name) DO NOTHING;

INSERT INTO dormitories (university_id, name, code, address, is_active)
SELECT id, 'Общежитие №2', 'D2', 'МФТИ кампус, Общежитие №2', TRUE FROM universities WHERE slug = 'mipt'
ON CONFLICT (university_id, name) DO NOTHING;

INSERT INTO dormitories (university_id, name, code, address, is_active)
SELECT id, 'Общежитие №3', 'D3', 'МФТИ кампус, Общежитие №3', TRUE FROM universities WHERE slug = 'mipt'
ON CONFLICT (university_id, name) DO NOTHING;

INSERT INTO dormitories (university_id, name, code, address, is_active)
SELECT id, 'Общежитие №4', 'D4', 'МФТИ кампус, Общежитие №4', TRUE FROM universities WHERE slug = 'mipt'
ON CONFLICT (university_id, name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Demo users  (password = "demo123")
-- ---------------------------------------------------------------------------
INSERT INTO users (
    email, username, password_hash, full_name, role,
    university_id, dormitory_id, room_label, bio,
    rating_avg, reviews_count, completed_tasks_count, created_tasks_count,
    email_verified_at, created_at, updated_at
)
SELECT
    v.email, v.username,
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TqznmGJJsuUIWCoC7ZklfU/yR8ey',
    v.full_name, 'user',
    uni.id, d.id,
    v.room_label, v.bio,
    v.rating_avg, v.reviews_count, v.completed_tasks_count, v.created_tasks_count,
    NOW() - (v.days_ago || ' days')::interval,
    NOW() - (v.days_ago || ' days')::interval,
    NOW() - (v.days_ago || ' days')::interval
FROM (VALUES
    ('alice@phystech.edu',  'alice',  'Алиса Смирнова',     'D1', '214', 'Помогаю с учёбой и переездами. Люблю порядок!',                4.80::numeric, 12, 10, 8,  90),
    ('bob@phystech.edu',    'bob',    'Борис Козлов',        'D1', '315', 'Технарь, чиню всё что ломается.',                              4.60::numeric,  8,  7, 5,  85),
    ('carol@phystech.edu',  'carol',  'Карина Новикова',     'D2', '102', 'Доставка, уборка — быстро и качественно.',                     4.90::numeric, 15, 14, 6,  80),
    ('dan@phystech.edu',    'dan',    'Даниил Фёдоров',      'D2', '207', 'Репетитор по математике и физике.',                            4.70::numeric, 10,  9, 7,  75),
    ('eva@phystech.edu',    'eva',    'Ева Морозова',        'D3', '301', 'Помогу с переездом и тяжёлыми вещами.',                        4.50::numeric,  6,  5, 4,  70),
    ('fedor@phystech.edu',  'fedor',  'Фёдор Волков',        'D3', '412', 'Программист, помогу с техническими задачами.',                 4.30::numeric,  4,  3, 6,  65),
    ('galina@phystech.edu', 'galina', 'Галина Петрова',      'D1', '118', 'Уборка и организация пространства — моё призвание.',           4.95::numeric, 20, 18, 3,  60),
    ('hasan@phystech.edu',  'hasan',  'Хасан Алиев',         'D2', '305', 'Доставка продуктов и посылок по кампусу.',                     4.40::numeric,  5,  4, 8,  55),
    ('irina@phystech.edu',  'irina',  'Ирина Захарова',      'D3', '210', 'Помогу с учёбой: химия, биология.',                            4.85::numeric, 11, 10, 5,  50),
    ('julia@phystech.edu',  'julia',  'Юлия Орлова',         'D1', '320', 'Организую переезды и помогаю с упаковкой.',                    4.20::numeric,  3,  2, 9,  45),
    ('kostya@phystech.edu', 'kostya', 'Константин Лебедев',  'D2', '115', 'Ремонт техники, настройка компьютеров.',                       4.75::numeric,  9,  8, 4,  40),
    ('lena@phystech.edu',   'lena',   'Елена Соколова',      'D3', '408', 'Репетитор по английскому и немецкому.',                        4.88::numeric, 16, 15, 2,  35)
) AS v(email, username, full_name, dorm_code, room_label, bio, rating_avg, reviews_count, completed_tasks_count, created_tasks_count, days_ago)
JOIN universities uni ON uni.slug = 'mipt'
JOIN dormitories d ON d.university_id = uni.id AND d.code = v.dorm_code
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = v.email);

-- ---------------------------------------------------------------------------
-- 3. Tasks — completed (15), in_progress (2), open (4), offers (2), cancelled (2)
-- ---------------------------------------------------------------------------

-- COMPLETED tasks
INSERT INTO tasks (
    customer_id, university_id, dormitory_id,
    title, description, category, urgency,
    payment_type, price_amount, barter_description,
    currency, visibility, status, offers_count,
    published_at, starts_at, completed_at,
    created_at, updated_at
)
SELECT
    u.id, uni.id, d.id,
    v.title, v.description, v.category, v.urgency,
    v.payment_type, v.price_amount::integer, v.barter_description,
    'RUB', v.visibility, 'completed', 1,
    NOW() - (v.days_ago || ' days')::interval,
    NOW() - (v.days_ago || ' days')::interval + '1 hour'::interval,
    NOW() - (v.days_ago || ' days')::interval + '1 day'::interval,
    NOW() - (v.days_ago || ' days')::interval,
    NOW() - (v.days_ago || ' days')::interval + '1 day'::interval
FROM (VALUES
    ('alice@phystech.edu',  'D1', 'Уборка комнаты после вечеринки',        'Генеральная уборка: пол, пыль, мусор. Комната ~18 кв.м.',                    'cleaning',   'urgent',    'fixed_price', '500',  NULL,                          'dormitory', 30),
    ('bob@phystech.edu',    'D1', 'Доставить продукты из Пятёрочки',        'Список продуктов на ~800 руб. Магазин в 10 мин ходьбы.',                      'delivery',   'today',     'fixed_price', '150',  NULL,                          'dormitory', 28),
    ('carol@phystech.edu',  'D2', 'Помочь перевезти вещи в новую комнату',  'Переезд внутри общежития, 3 коробки и матрас.',                               'moving',     'this_week', 'barter',      NULL,   'Приготовлю домашний ужин',    'dormitory', 25),
    ('dan@phystech.edu',    'D2', 'Объяснить тервер перед экзаменом',       'Теория вероятностей: 2 часа занятий.',                                        'study_help', 'urgent',    'fixed_price', '800',  NULL,                          'university', 22),
    ('eva@phystech.edu',    'D3', 'Настроить VPN на ноутбуке',              'MacBook, нужен рабочий VPN для учёбы.',                                       'tech_help',  'today',     'fixed_price', '300',  NULL,                          'dormitory', 20),
    ('fedor@phystech.edu',  'D3', 'Помыть посуду после готовки',            'Накопилась посуда за 3 дня.',                                                 'cleaning',   'today',     'barter',      NULL,   'Угощу пиццей',                'dormitory', 18),
    ('galina@phystech.edu', 'D1', 'Забрать посылку с почты',                'Посылка на почте в Долгопрудном, принести в общежитие.',                      'delivery',   'this_week', 'fixed_price', '200',  NULL,                          'university', 16),
    ('hasan@phystech.edu',  'D2', 'Помочь с курсовой по физике',            'Помощь с оформлением и расчётами.',                                           'study_help', 'this_week', 'barter',      NULL,   'Помогу с английским',         'university', 14),
    ('irina@phystech.edu',  'D3', 'Помочь поднять холодильник на 4 этаж',   'Холодильник небольшой, нужен 1 помощник.',                                    'moving',     'urgent',    'fixed_price', '600',  NULL,                          'dormitory', 12),
    ('julia@phystech.edu',  'D1', 'Починить принтер',                       'Принтер HP не печатает, нужна диагностика.',                                  'tech_help',  'this_week', 'fixed_price', '400',  NULL,                          'dormitory', 10),
    ('kostya@phystech.edu', 'D2', 'Уборка кухни на этаже',                  'Общая кухня: плита, раковина, пол.',                                          'cleaning',   'today',     'fixed_price', '350',  NULL,                          'dormitory',  8),
    ('lena@phystech.edu',   'D3', 'Купить лекарства в аптеке',              'Список лекарств, аптека рядом с метро.',                                      'delivery',   'urgent',    'barter',      NULL,   'Испеку домашнее печенье',     'university',  7),
    ('alice@phystech.edu',  'D1', 'Репетитор по линейной алгебре',          '3 занятия по 1.5 часа перед сессией.',                                        'study_help', 'this_week', 'fixed_price', '1200', NULL,                          'university',  6),
    ('bob@phystech.edu',    'D1', 'Сфотографировать для портфолио',         '10-15 фото в кампусе, 1 час.',                                                'other',      'flexible',  'fixed_price', '700',  NULL,                          'university',  5),
    ('carol@phystech.edu',  'D2', 'Помочь разобрать шкаф и упаковать вещи', 'Переезд домой на каникулы, помощь с упаковкой.',                              'moving',     'this_week', 'fixed_price', '500',  NULL,                          'dormitory',  4)
) AS v(customer_email, dorm_code, title, description, category, urgency, payment_type, price_amount, barter_description, visibility, days_ago)
JOIN users u ON u.email = v.customer_email
JOIN universities uni ON uni.slug = 'mipt'
JOIN dormitories d ON d.university_id = uni.id AND d.code = v.dorm_code;

-- IN_PROGRESS tasks
INSERT INTO tasks (
    customer_id, university_id, dormitory_id,
    title, description, category, urgency,
    payment_type, price_amount, barter_description,
    currency, visibility, status, offers_count,
    published_at, starts_at,
    created_at, updated_at
)
SELECT
    u.id, uni.id, d.id,
    v.title, v.description, v.category, v.urgency,
    v.payment_type, v.price_amount::integer, v.barter_description,
    'RUB', v.visibility, 'in_progress', 1,
    NOW() - (v.hours_ago || ' hours')::interval,
    NOW() - (v.hours_ago || ' hours')::interval + '30 minutes'::interval,
    NOW() - (v.hours_ago || ' hours')::interval,
    NOW() - (v.hours_ago || ' hours')::interval
FROM (VALUES
    ('dan@phystech.edu', 'D2', 'Уборка комнаты раз в неделю', 'Нужна регулярная уборка, первый раз — в эту пятницу.', 'cleaning',  'this_week', 'fixed_price', '600', NULL, 'dormitory', 48),
    ('eva@phystech.edu', 'D3', 'Установить Linux на ноутбук',  'Ubuntu 22.04, помощь с разметкой диска.',              'tech_help', 'today',     'fixed_price', '500', NULL, 'dormitory', 24)
) AS v(customer_email, dorm_code, title, description, category, urgency, payment_type, price_amount, barter_description, visibility, hours_ago)
JOIN users u ON u.email = v.customer_email
JOIN universities uni ON uni.slug = 'mipt'
JOIN dormitories d ON d.university_id = uni.id AND d.code = v.dorm_code;

-- OPEN tasks
INSERT INTO tasks (
    customer_id, university_id, dormitory_id,
    title, description, category, urgency,
    payment_type, price_amount, barter_description,
    currency, visibility, status, offers_count,
    published_at, created_at, updated_at
)
SELECT
    u.id, uni.id, d.id,
    v.title, v.description, v.category, v.urgency,
    v.payment_type, v.price_amount::integer, v.barter_description,
    'RUB', v.visibility, 'open', 0,
    NOW() - (v.hours_ago || ' hours')::interval,
    NOW() - (v.hours_ago || ' hours')::interval,
    NOW() - (v.hours_ago || ' hours')::interval
FROM (VALUES
    ('fedor@phystech.edu',  'D3', 'Доставить еду из столовой',    'Обед из столовой №2, нахожусь в корпусе.',  'delivery',  'urgent',   'fixed_price', '100', NULL,                  'dormitory', 3),
    ('hasan@phystech.edu',  'D2', 'Помыть окна в комнате',        'Два окна, средство есть.',                  'cleaning',  'flexible', 'barter',      NULL,  'Угощу домашней едой', 'dormitory', 2),
    ('irina@phystech.edu',  'D3', 'Перенести книги в библиотеку', '4 тяжёлые стопки книг, 5 минут ходьбы.',   'moving',    'today',    'fixed_price', '200', NULL,                  'university', 1),
    ('julia@phystech.edu',  'D1', 'Помочь с настройкой роутера',  'Роутер TP-Link, настройка Wi-Fi.',          'tech_help', 'today',    'fixed_price', '250', NULL,                  'dormitory', 1)
) AS v(customer_email, dorm_code, title, description, category, urgency, payment_type, price_amount, barter_description, visibility, hours_ago)
JOIN users u ON u.email = v.customer_email
JOIN universities uni ON uni.slug = 'mipt'
JOIN dormitories d ON d.university_id = uni.id AND d.code = v.dorm_code;

-- OFFERS tasks (have pending offers)
INSERT INTO tasks (
    customer_id, university_id, dormitory_id,
    title, description, category, urgency,
    payment_type, price_amount, barter_description,
    currency, visibility, status, offers_count,
    published_at, created_at, updated_at
)
SELECT
    u.id, uni.id, d.id,
    v.title, v.description, v.category, v.urgency,
    v.payment_type, v.price_amount::integer, v.barter_description,
    'RUB', v.visibility, 'offers', v.offers_count::integer,
    NOW() - (v.hours_ago || ' hours')::interval,
    NOW() - (v.hours_ago || ' hours')::interval,
    NOW() - (v.hours_ago || ' hours')::interval
FROM (VALUES
    ('galina@phystech.edu', 'D1', 'Помощь с дипломной работой',       'Помощь с написанием введения и заключения.', 'study_help', 'this_week', 'fixed_price', '2000', NULL, 'university', '2', 5),
    ('kostya@phystech.edu', 'D2', 'Помочь с переездом в новый корпус', 'Несколько коробок и сумок, 3 этаж.',        'moving',     'this_week', 'fixed_price', '800',  NULL, 'dormitory',  '1', 6)
) AS v(customer_email, dorm_code, title, description, category, urgency, payment_type, price_amount, barter_description, visibility, offers_count, hours_ago)
JOIN users u ON u.email = v.customer_email
JOIN universities uni ON uni.slug = 'mipt'
JOIN dormitories d ON d.university_id = uni.id AND d.code = v.dorm_code;

-- CANCELLED tasks
INSERT INTO tasks (
    customer_id, university_id, dormitory_id,
    title, description, category, urgency,
    payment_type, price_amount, barter_description,
    currency, visibility, status, offers_count,
    published_at, cancelled_at, cancellation_reason,
    created_at, updated_at
)
SELECT
    u.id, uni.id, d.id,
    v.title, v.description, v.category, v.urgency,
    v.payment_type, v.price_amount::integer, v.barter_description,
    'RUB', v.visibility, 'cancelled', 0,
    NOW() - (v.days_ago || ' days')::interval,
    NOW() - (v.days_ago || ' days')::interval + '1 day'::interval,
    v.cancel_reason,
    NOW() - (v.days_ago || ' days')::interval,
    NOW() - (v.days_ago || ' days')::interval + '1 day'::interval
FROM (VALUES
    ('lena@phystech.edu',  'D3', 'Купить зарядку для телефона',       'Samsung Type-C, магазин в ТЦ.',  'delivery', 'urgent',   'fixed_price', '300', NULL,                  'dormitory', 'Нашла сама',  15),
    ('alice@phystech.edu', 'D1', 'Помочь с фотосессией для соцсетей', 'Фотограф на 30 минут.',          'other',    'flexible', 'barter',      NULL,  'Помогу с английским', 'university', 'Передумала', 20)
) AS v(customer_email, dorm_code, title, description, category, urgency, payment_type, price_amount, barter_description, visibility, cancel_reason, days_ago)
JOIN users u ON u.email = v.customer_email
JOIN universities uni ON uni.slug = 'mipt'
JOIN dormitories d ON d.university_id = uni.id AND d.code = v.dorm_code;

-- ---------------------------------------------------------------------------
-- 4. Task offers
-- ---------------------------------------------------------------------------

-- Accepted offers for completed tasks
INSERT INTO task_offers (task_id, performer_id, message, price_amount, payment_type, barter_description, status, created_at, updated_at)
SELECT
    t.id,
    perf.id,
    v.message,
    t.price_amount,
    t.payment_type,
    t.barter_description,
    'accepted',
    t.created_at + '2 hours'::interval,
    t.created_at + '3 hours'::interval
FROM (VALUES
    ('alice@phystech.edu',  'carol@phystech.edu',  'Уборка комнаты после вечеринки',        'Сделаю быстро и качественно, опыт есть!'),
    ('bob@phystech.edu',    'galina@phystech.edu', 'Доставить продукты из Пятёрочки',        'Доставлю в течение часа.'),
    ('carol@phystech.edu',  'eva@phystech.edu',    'Помочь перевезти вещи в новую комнату',  'Помогу с переездом, есть тележка.'),
    ('dan@phystech.edu',    'lena@phystech.edu',   'Объяснить тервер перед экзаменом',       'Отлично знаю тервер, объясню понятно.'),
    ('eva@phystech.edu',    'fedor@phystech.edu',  'Настроить VPN на ноутбуке',              'Настрою VPN за 20 минут.'),
    ('fedor@phystech.edu',  'alice@phystech.edu',  'Помыть посуду после готовки',            'Помою посуду, не проблема.'),
    ('galina@phystech.edu', 'dan@phystech.edu',    'Забрать посылку с почты',                'Заберу посылку завтра утром.'),
    ('hasan@phystech.edu',  'irina@phystech.edu',  'Помочь с курсовой по физике',            'Помогу с физикой, сама сдавала на отлично.'),
    ('irina@phystech.edu',  'bob@phystech.edu',    'Помочь поднять холодильник на 4 этаж',   'Подниму холодильник, есть опыт.'),
    ('julia@phystech.edu',  'kostya@phystech.edu', 'Починить принтер',                       'Починю принтер, знаю HP хорошо.'),
    ('kostya@phystech.edu', 'carol@phystech.edu',  'Уборка кухни на этаже',                  'Уберу кухню за час.'),
    ('lena@phystech.edu',   'alice@phystech.edu',  'Купить лекарства в аптеке',              'Куплю лекарства, живу рядом с аптекой.'),
    ('alice@phystech.edu',  'dan@phystech.edu',    'Репетитор по линейной алгебре',          'Репетитор по алгебре, 5 лет опыта.'),
    ('bob@phystech.edu',    'fedor@phystech.edu',  'Сфотографировать для портфолио',         'Умею фотографировать, есть зеркалка.'),
    ('carol@phystech.edu',  'hasan@phystech.edu',  'Помочь разобрать шкаф и упаковать вещи', 'Помогу упаковать вещи.')
) AS v(customer_email, performer_email, task_title, message)
JOIN tasks t ON t.customer_id = (SELECT id FROM users WHERE email = v.customer_email)
           AND t.title = v.task_title
           AND t.status = 'completed'
JOIN users perf ON perf.email = v.performer_email
WHERE perf.id <> t.customer_id
ON CONFLICT (task_id, performer_id) DO NOTHING;

-- Accepted offers for in_progress tasks
INSERT INTO task_offers (task_id, performer_id, message, price_amount, payment_type, barter_description, status, created_at, updated_at)
SELECT
    t.id, perf.id, v.message,
    t.price_amount, t.payment_type, t.barter_description,
    'accepted',
    t.created_at + '1 hour'::interval,
    t.created_at + '2 hours'::interval
FROM (VALUES
    ('dan@phystech.edu', 'galina@phystech.edu', 'Уборка комнаты раз в неделю', 'Уберу в пятницу, всё включено.'),
    ('eva@phystech.edu', 'kostya@phystech.edu', 'Установить Linux на ноутбук',  'Установлю Linux, делал много раз.')
) AS v(customer_email, performer_email, task_title, message)
JOIN tasks t ON t.customer_id = (SELECT id FROM users WHERE email = v.customer_email)
           AND t.title = v.task_title
           AND t.status = 'in_progress'
JOIN users perf ON perf.email = v.performer_email
WHERE perf.id <> t.customer_id
ON CONFLICT (task_id, performer_id) DO NOTHING;

-- Pending offers for 'offers' tasks
INSERT INTO task_offers (task_id, performer_id, message, price_amount, payment_type, barter_description, status, created_at, updated_at)
SELECT
    t.id, perf.id, v.message,
    t.price_amount, t.payment_type, t.barter_description,
    'pending',
    t.created_at + '1 hour'::interval,
    t.created_at + '1 hour'::interval
FROM (VALUES
    ('galina@phystech.edu', 'alice@phystech.edu', 'Помощь с дипломной работой',       'Помогу с дипломной, пишу хорошо.'),
    ('galina@phystech.edu', 'dan@phystech.edu',   'Помощь с дипломной работой',       'Могу помочь с введением.'),
    ('kostya@phystech.edu', 'eva@phystech.edu',   'Помочь с переездом в новый корпус','Помогу с переездом, есть тележка.')
) AS v(customer_email, performer_email, task_title, message)
JOIN tasks t ON t.customer_id = (SELECT id FROM users WHERE email = v.customer_email)
           AND t.title = v.task_title
           AND t.status = 'offers'
JOIN users perf ON perf.email = v.performer_email
WHERE perf.id <> t.customer_id
ON CONFLICT (task_id, performer_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Set accepted_offer_id on completed / in_progress tasks
-- ---------------------------------------------------------------------------
UPDATE tasks t
SET accepted_offer_id = o.id,
    updated_at = NOW()
FROM task_offers o
WHERE o.task_id = t.id
  AND o.status = 'accepted'
  AND t.status IN ('completed', 'in_progress')
  AND t.accepted_offer_id IS NULL;

-- ---------------------------------------------------------------------------
-- 6. Task assignments for completed / in_progress tasks
-- ---------------------------------------------------------------------------
INSERT INTO task_assignments (
    task_id, offer_id, customer_id, performer_id,
    agreed_price_amount, agreed_payment_type, agreed_barter_description,
    status, assigned_at, started_at, completed_at,
    created_at, updated_at
)
SELECT
    t.id, o.id, t.customer_id, o.performer_id,
    o.price_amount, o.payment_type, o.barter_description,
    CASE WHEN t.status = 'completed' THEN 'completed' ELSE 'in_progress' END,
    t.created_at + '3 hours'::interval,
    t.created_at + '3 hours'::interval,
    CASE WHEN t.status = 'completed' THEN t.completed_at ELSE NULL END,
    t.created_at + '3 hours'::interval,
    COALESCE(t.completed_at, NOW())
FROM tasks t
JOIN task_offers o ON o.id = t.accepted_offer_id
WHERE t.status IN ('completed', 'in_progress')
ON CONFLICT (task_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Task completion confirmations
-- ---------------------------------------------------------------------------
INSERT INTO task_completion_confirmations (
    task_assignment_id, customer_confirmed_at, performer_confirmed_at,
    status, created_at, updated_at
)
SELECT
    a.id,
    t.completed_at - '2 hours'::interval,
    t.completed_at - '3 hours'::interval,
    'completed',
    t.completed_at - '4 hours'::interval,
    t.completed_at
FROM task_assignments a
JOIN tasks t ON t.id = a.task_id
WHERE t.status = 'completed'
ON CONFLICT (task_assignment_id) DO NOTHING;

-- Pending confirmation for in_progress tasks
INSERT INTO task_completion_confirmations (
    task_assignment_id, status, created_at, updated_at
)
SELECT
    a.id, 'pending', a.created_at, a.created_at
FROM task_assignments a
JOIN tasks t ON t.id = a.task_id
WHERE t.status = 'in_progress'
ON CONFLICT (task_assignment_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Task chats for completed / in_progress tasks
-- ---------------------------------------------------------------------------
INSERT INTO task_chats (task_id, customer_id, performer_id, created_at, updated_at)
SELECT
    t.id,
    t.customer_id,
    a.performer_id,
    t.created_at + '3 hours'::interval,
    COALESCE(t.completed_at, NOW())
FROM tasks t
JOIN task_assignments a ON a.task_id = t.id
WHERE t.status IN ('completed', 'in_progress')
ON CONFLICT (task_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. Chat messages for completed tasks
-- ---------------------------------------------------------------------------
INSERT INTO chat_messages (chat_id, sender_id, message_type, body, read_at, created_at)
SELECT
    c.id,
    CASE WHEN msg.role = 'performer' THEN c.performer_id ELSE c.customer_id END,
    'text',
    msg.body,
    t.completed_at,
    t.created_at + (msg.offset_hours || ' hours')::interval
FROM task_chats c
JOIN tasks t ON t.id = c.task_id
CROSS JOIN (VALUES
    (1, 'performer', 'Привет! Готов приступить, когда удобно.'),
    (2, 'customer',  'Отлично, жду тебя в 18:00.'),
    (3, 'performer', 'Буду вовремя, всё сделаю качественно.'),
    (4, 'customer',  'Спасибо, всё отлично получилось!')
) AS msg(offset_hours, role, body)
WHERE t.status = 'completed';

-- ---------------------------------------------------------------------------
-- 10. Reviews for completed tasks (customer → performer)
-- ---------------------------------------------------------------------------
INSERT INTO reviews (
    task_id, task_assignment_id, author_id, target_user_id,
    rating, comment, is_visible, moderation_status,
    created_at, updated_at
)
SELECT
    t.id, a.id, t.customer_id, a.performer_id,
    v.rating, v.comment, TRUE, 'approved',
    t.completed_at + '1 hour'::interval,
    t.completed_at + '1 hour'::interval
FROM tasks t
JOIN task_assignments a ON a.task_id = t.id
JOIN (VALUES
    ('Уборка комнаты после вечеринки',        5, 'Всё сделала идеально, очень довольна!'),
    ('Доставить продукты из Пятёрочки',        5, 'Быстро и без проблем, рекомендую.'),
    ('Помочь перевезти вещи в новую комнату',  4, 'Помогла, но немного опоздала.'),
    ('Объяснить тервер перед экзаменом',       5, 'Объяснила всё понятно, сдал на отлично!'),
    ('Настроить VPN на ноутбуке',              5, 'Настроил быстро, всё работает.'),
    ('Помыть посуду после готовки',            4, 'Хорошо, но не всё домыла.'),
    ('Забрать посылку с почты',                5, 'Принёс вовремя, спасибо!'),
    ('Помочь с курсовой по физике',            5, 'Очень помогла, курсовая сдана!'),
    ('Помочь поднять холодильник на 4 этаж',   5, 'Справился отлично, сильный парень!'),
    ('Починить принтер',                       4, 'Починил, но пришлось подождать.'),
    ('Уборка кухни на этаже',                  5, 'Кухня блестит, спасибо!'),
    ('Купить лекарства в аптеке',              5, 'Купила всё что нужно, очень выручила!'),
    ('Репетитор по линейной алгебре',          5, 'Отличный репетитор, всё объяснил!'),
    ('Сфотографировать для портфолио',         4, 'Хорошие фото, но мало вариантов.'),
    ('Помочь разобрать шкаф и упаковать вещи', 5, 'Упаковал быстро и аккуратно!')
) AS v(task_title, rating, comment) ON t.title = v.task_title
WHERE t.status = 'completed'
ON CONFLICT (task_assignment_id, author_id) DO NOTHING;

-- Reviews for completed tasks (performer → customer)
INSERT INTO reviews (
    task_id, task_assignment_id, author_id, target_user_id,
    rating, comment, is_visible, moderation_status,
    created_at, updated_at
)
SELECT
    t.id, a.id, a.performer_id, t.customer_id,
    v.rating, v.comment, TRUE, 'approved',
    t.completed_at + '2 hours'::interval,
    t.completed_at + '2 hours'::interval
FROM tasks t
JOIN task_assignments a ON a.task_id = t.id
JOIN (VALUES
    ('Уборка комнаты после вечеринки',        5, 'Приятный заказчик, всё чётко объяснила.'),
    ('Доставить продукты из Пятёрочки',        5, 'Быстро ответил, деньги отдал сразу.'),
    ('Помочь перевезти вещи в новую комнату',  5, 'Хорошая заказчица, всё заранее подготовила.'),
    ('Объяснить тервер перед экзаменом',       5, 'Внимательный студент, всё схватывал быстро.'),
    ('Настроить VPN на ноутбуке',              4, 'Нормальный заказчик, немного нетерпеливый.'),
    ('Помыть посуду после готовки',            5, 'Хороший парень, угостил пиццей как обещал.'),
    ('Забрать посылку с почты',                5, 'Всё чётко, спасибо за чаевые!'),
    ('Помочь с курсовой по физике',            4, 'Заказчик понятно объяснил задачу.'),
    ('Помочь поднять холодильник на 4 этаж',   5, 'Приятная девушка, заплатила сразу.'),
    ('Починить принтер',                       5, 'Хорошая заказчица, терпеливая.'),
    ('Уборка кухни на этаже',                  5, 'Всё чётко, оплата сразу.'),
    ('Купить лекарства в аптеке',              5, 'Приятная заказчица, угостила печеньем!'),
    ('Репетитор по линейной алгебре',          5, 'Старательный студент, приятно работать.'),
    ('Сфотографировать для портфолио',         4, 'Нормальный заказчик, немного менял планы.'),
    ('Помочь разобрать шкаф и упаковать вещи', 5, 'Хорошая заказчица, всё подготовила заранее.')
) AS v(task_title, rating, comment) ON t.title = v.task_title
WHERE t.status = 'completed'
ON CONFLICT (task_assignment_id, author_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 11. Notifications
-- ---------------------------------------------------------------------------
INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, is_read, created_at)
SELECT a.performer_id, 'offer_accepted', 'Ваш отклик принят',
       'Заказчик выбрал вас исполнителем по задаче «' || t.title || '».',
       'task', t.id, TRUE, t.created_at + '3 hours'::interval
FROM tasks t JOIN task_assignments a ON a.task_id = t.id
WHERE t.status IN ('completed', 'in_progress');

INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, is_read, created_at)
SELECT t.customer_id, 'task_completed_confirmed', 'Задача завершена',
       'Задача «' || t.title || '» успешно выполнена.',
       'task', t.id, TRUE, t.completed_at
FROM tasks t WHERE t.status = 'completed';

INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, is_read, created_at)
SELECT r.target_user_id, 'review_received', 'Новый отзыв',
       'Вы получили отзыв по задаче «' || t.title || '».',
       'task', t.id, FALSE, t.completed_at + '1 hour'::interval
FROM reviews r JOIN tasks t ON t.id = r.task_id
WHERE t.status = 'completed';

INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, is_read, created_at)
SELECT t.customer_id, 'offer_received', 'Новый отклик на задачу',
       'Исполнитель оставил предложение по задаче «' || t.title || '».',
       'task', t.id, FALSE, t.created_at + '1 hour'::interval
FROM tasks t WHERE t.status = 'offers';

-- ---------------------------------------------------------------------------
-- 12. Update user counters
-- ---------------------------------------------------------------------------
UPDATE users u
SET created_tasks_count = COALESCE(s.cnt, 0), updated_at = NOW()
FROM (SELECT customer_id, COUNT(*)::int AS cnt FROM tasks GROUP BY customer_id) s
WHERE u.id = s.customer_id;

UPDATE users u
SET completed_tasks_count = COALESCE(s.cnt, 0), updated_at = NOW()
FROM (SELECT performer_id, COUNT(*)::int AS cnt FROM task_assignments WHERE status = 'completed' GROUP BY performer_id) s
WHERE u.id = s.performer_id;

UPDATE users u
SET rating_avg = COALESCE(s.avg_r, 0), reviews_count = COALESCE(s.cnt, 0), updated_at = NOW()
FROM (SELECT target_user_id, ROUND(AVG(rating)::numeric, 2) AS avg_r, COUNT(*)::int AS cnt
      FROM reviews WHERE is_visible = TRUE GROUP BY target_user_id) s
WHERE u.id = s.target_user_id;

COMMIT;