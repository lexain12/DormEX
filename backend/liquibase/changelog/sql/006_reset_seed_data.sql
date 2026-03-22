--liquibase formatted sql

--changeset codex:006-reset-seed-data
TRUNCATE TABLE
    audit_logs,
    reports,
    web_push_subscriptions,
    notification_preferences,
    notifications,
    reviews,
    chat_messages,
    task_chats,
    task_completion_confirmations,
    task_assignments,
    offer_counter_offers,
    task_offers,
    tasks,
    email_verification_codes,
    user_sessions,
    users,
    dormitories,
    universities
RESTART IDENTITY CASCADE;

INSERT INTO universities (name, slug, email_domain, is_active)
VALUES ('МФТИ', 'mipt', 'phystech.edu', TRUE);

INSERT INTO dormitories (university_id, name, code, address, is_active)
SELECT id, 'Общежитие №1', 'D1', 'МФТИ кампус, Общежитие №1', TRUE
FROM universities
WHERE email_domain = 'phystech.edu';

INSERT INTO dormitories (university_id, name, code, address, is_active)
SELECT id, 'Общежитие №2', 'D2', 'МФТИ кампус, Общежитие №2', TRUE
FROM universities
WHERE email_domain = 'phystech.edu';

INSERT INTO dormitories (university_id, name, code, address, is_active)
SELECT id, 'Общежитие №3', 'D3', 'МФТИ кампус, Общежитие №3', TRUE
FROM universities
WHERE email_domain = 'phystech.edu';

INSERT INTO dormitories (university_id, name, code, address, is_active)
SELECT id, 'Общежитие №4', 'D4', 'МФТИ кампус, Общежитие №4', TRUE
FROM universities
WHERE email_domain = 'phystech.edu';

INSERT INTO users (
    email,
    email_verified_at,
    username,
    password_hash,
    full_name,
    role,
    university_id,
    bio
)
SELECT
    'admin1@phystech.edu',
    CURRENT_TIMESTAMP,
    'admin1',
    'admin1_salt_16he:eda93641787ae37e57a880b9cf8476029073a4b88bb8ec9b1684ce132cf2ef77',
    'Администратор Один',
    'admin',
    id,
    'Системный администратор'
FROM universities
WHERE email_domain = 'phystech.edu';

INSERT INTO users (
    email,
    email_verified_at,
    username,
    password_hash,
    full_name,
    role,
    university_id,
    bio
)
SELECT
    'admin2@phystech.edu',
    CURRENT_TIMESTAMP,
    'admin2',
    'admin2_salt_16he:361755643c6fe2bc27989a54630b89d25a3ec6ed533c7a8862caf94a9f34239b',
    'Администратор Два',
    'admin',
    id,
    'Системный администратор'
FROM universities
WHERE email_domain = 'phystech.edu';

INSERT INTO users (
    email,
    email_verified_at,
    username,
    password_hash,
    full_name,
    role,
    university_id,
    dormitory_id,
    bio
)
SELECT
    'user1@phystech.edu',
    CURRENT_TIMESTAMP,
    'user1',
    'user1_salt_16hex:5a1b08ddc4713d950fd998194e1df6cbec695dbeb8b6be8e3fa1d04768147770',
    'Пользователь Один',
    'user',
    u.id,
    d.id,
    'Житель общежития №1'
FROM universities u
JOIN dormitories d ON d.university_id = u.id AND d.code = 'D1'
WHERE u.email_domain = 'phystech.edu';

INSERT INTO users (
    email,
    email_verified_at,
    username,
    password_hash,
    full_name,
    role,
    university_id,
    dormitory_id,
    bio
)
SELECT
    'user2@phystech.edu',
    CURRENT_TIMESTAMP,
    'user2',
    'user2_salt_16hex:e10c97784374ba933589a1f4322db43668e73e812cce89e836eecf5fc67ceecd',
    'Пользователь Два',
    'user',
    u.id,
    d.id,
    'Житель общежития №2'
FROM universities u
JOIN dormitories d ON d.university_id = u.id AND d.code = 'D2'
WHERE u.email_domain = 'phystech.edu';

INSERT INTO users (
    email,
    email_verified_at,
    username,
    password_hash,
    full_name,
    role,
    university_id,
    dormitory_id,
    bio
)
SELECT
    'user3@phystech.edu',
    CURRENT_TIMESTAMP,
    'user3',
    'user3_salt_16hex:a9409e126445eea8e6e7d53e41de4ec4af32b82b6038733b59fbce48a1b0059f',
    'Пользователь Три',
    'user',
    u.id,
    d.id,
    'Житель общежития №3'
FROM universities u
JOIN dormitories d ON d.university_id = u.id AND d.code = 'D3'
WHERE u.email_domain = 'phystech.edu';

INSERT INTO users (
    email,
    email_verified_at,
    username,
    password_hash,
    full_name,
    role,
    university_id,
    dormitory_id,
    bio
)
SELECT
    'user4@phystech.edu',
    CURRENT_TIMESTAMP,
    'user4',
    'user4_salt_16hex:dee2d024b37ef2485a56318afd088c79e19b1b792d16d0b6a78b38c8f7cd4a2a',
    'Пользователь Четыре',
    'user',
    u.id,
    d.id,
    'Житель общежития №4'
FROM universities u
JOIN dormitories d ON d.university_id = u.id AND d.code = 'D4'
WHERE u.email_domain = 'phystech.edu';

INSERT INTO tasks (
    customer_id,
    university_id,
    dormitory_id,
    title,
    description,
    category,
    urgency,
    payment_type,
    price_amount,
    currency,
    visibility,
    status,
    published_at,
    created_at,
    updated_at
)
SELECT
    u.id,
    u.university_id,
    u.dormitory_id,
    'Помочь перенести коробки',
    'Нужно перенести несколько коробок между этажами.',
    'moving',
    'today',
    'fixed_price',
    700,
    'RUB',
    'university',
    'open',
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    CURRENT_TIMESTAMP - INTERVAL '4 hours'
FROM users u
WHERE u.username = 'user1';

INSERT INTO tasks (
    customer_id,
    university_id,
    dormitory_id,
    title,
    description,
    category,
    urgency,
    payment_type,
    price_amount,
    currency,
    visibility,
    status,
    published_at,
    created_at,
    updated_at
)
SELECT
    u.id,
    u.university_id,
    u.dormitory_id,
    'Купить продукты после пар',
    'Нужна доставка продуктов из ближайшего магазина.',
    'delivery',
    'today',
    'fixed_price',
    500,
    'RUB',
    'university',
    'open',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    CURRENT_TIMESTAMP - INTERVAL '3 hours'
FROM users u
WHERE u.username = 'user2';

INSERT INTO tasks (
    customer_id,
    university_id,
    dormitory_id,
    title,
    description,
    category,
    urgency,
    payment_type,
    price_amount,
    currency,
    visibility,
    status,
    published_at,
    created_at,
    updated_at
)
SELECT
    u.id,
    u.university_id,
    u.dormitory_id,
    'Настроить Wi-Fi роутер',
    'Нужна помощь с настройкой роутера в комнате.',
    'tech_help',
    'this_week',
    'fixed_price',
    900,
    'RUB',
    'dormitory',
    'open',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
FROM users u
WHERE u.username = 'user3';

INSERT INTO tasks (
    customer_id,
    university_id,
    dormitory_id,
    title,
    description,
    category,
    urgency,
    payment_type,
    price_amount,
    currency,
    visibility,
    status,
    published_at,
    created_at,
    updated_at
)
SELECT
    u.id,
    u.university_id,
    u.dormitory_id,
    'Помочь с уборкой комнаты',
    'Нужен человек на короткую уборку перед проверкой.',
    'cleaning',
    'urgent',
    'fixed_price',
    600,
    'RUB',
    'dormitory',
    'open',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    CURRENT_TIMESTAMP - INTERVAL '1 hour'
FROM users u
WHERE u.username = 'user4';

UPDATE users u
SET created_tasks_count = task_stats.created_tasks_count,
    updated_at = CURRENT_TIMESTAMP
FROM (
    SELECT customer_id, COUNT(*)::INTEGER AS created_tasks_count
    FROM tasks
    GROUP BY customer_id
) AS task_stats
WHERE u.id = task_stats.customer_id;
