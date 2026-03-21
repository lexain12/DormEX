DROP TABLE IF EXISTS tasks CASCADE;

CREATE TABLE universities (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    email_domain VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dormitories (
    id BIGSERIAL PRIMARY KEY,
    university_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    address VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dormitories_university
        FOREIGN KEY (university_id) REFERENCES universities (id),
    CONSTRAINT uq_dormitories_university_name UNIQUE (university_id, name),
    CONSTRAINT uq_dormitories_id_university UNIQUE (id, university_id)
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified_at TIMESTAMPTZ,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(30) NOT NULL DEFAULT 'student',
    university_id BIGINT NOT NULL,
    dormitory_id BIGINT,
    room_label VARCHAR(50),
    bio TEXT,
    rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
    reviews_count INTEGER NOT NULL DEFAULT 0,
    completed_tasks_count INTEGER NOT NULL DEFAULT 0,
    created_tasks_count INTEGER NOT NULL DEFAULT 0,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_university
        FOREIGN KEY (university_id) REFERENCES universities (id),
    CONSTRAINT fk_users_dormitory_same_university
        FOREIGN KEY (dormitory_id, university_id) REFERENCES dormitories (id, university_id),
    CONSTRAINT uq_users_id_university UNIQUE (id, university_id),
    CONSTRAINT chk_users_role
        CHECK (role IN ('student', 'moderator', 'admin')),
    CONSTRAINT chk_users_rating_avg
        CHECK (rating_avg >= 0 AND rating_avg <= 5),
    CONSTRAINT chk_users_reviews_count
        CHECK (reviews_count >= 0),
    CONSTRAINT chk_users_completed_tasks_count
        CHECK (completed_tasks_count >= 0),
    CONSTRAINT chk_users_created_tasks_count
        CHECK (created_tasks_count >= 0)
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL,
    refresh_token_hash VARCHAR(255) NOT NULL,
    user_agent TEXT,
    ip INET,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_sessions_user
        FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE email_verification_codes (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    university_id BIGINT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_email_verification_codes_university
        FOREIGN KEY (university_id) REFERENCES universities (id)
);

CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    university_id BIGINT NOT NULL,
    dormitory_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    urgency VARCHAR(30) NOT NULL,
    payment_type VARCHAR(30) NOT NULL,
    price_amount INTEGER,
    barter_description TEXT,
    currency VARCHAR(10) NOT NULL DEFAULT 'RUB',
    visibility VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    accepted_offer_id BIGINT,
    offers_count INTEGER NOT NULL DEFAULT 0,
    published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    starts_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tasks_customer_same_university
        FOREIGN KEY (customer_id, university_id) REFERENCES users (id, university_id),
    CONSTRAINT fk_tasks_dormitory_same_university
        FOREIGN KEY (dormitory_id, university_id) REFERENCES dormitories (id, university_id),
    CONSTRAINT chk_tasks_category
        CHECK (category IN ('cleaning', 'moving', 'delivery', 'tech_help', 'study_help', 'other')),
    CONSTRAINT chk_tasks_urgency
        CHECK (urgency IN ('urgent', 'today', 'this_week', 'flexible')),
    CONSTRAINT chk_tasks_visibility
        CHECK (visibility IN ('dormitory', 'university')),
    CONSTRAINT chk_tasks_status
        CHECK (status IN ('open', 'offers', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT chk_tasks_offers_count
        CHECK (offers_count >= 0),
    CONSTRAINT chk_tasks_payment
        CHECK (
            (payment_type = 'fixed_price' AND price_amount IS NOT NULL AND price_amount > 0 AND barter_description IS NULL)
            OR (payment_type = 'negotiable' AND price_amount IS NULL AND barter_description IS NULL)
            OR (payment_type = 'barter' AND price_amount IS NULL AND barter_description IS NOT NULL)
        )
);

CREATE TABLE task_offers (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    performer_id BIGINT NOT NULL,
    message TEXT NOT NULL,
    price_amount INTEGER,
    payment_type VARCHAR(30) NOT NULL,
    barter_description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_offers_task
        FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_offers_performer
        FOREIGN KEY (performer_id) REFERENCES users (id),
    CONSTRAINT uq_task_offers_task_performer UNIQUE (task_id, performer_id),
    CONSTRAINT uq_task_offers_id_task UNIQUE (id, task_id),
    CONSTRAINT chk_task_offers_status
        CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    CONSTRAINT chk_task_offers_payment
        CHECK (
            (payment_type = 'fixed_price' AND price_amount IS NOT NULL AND price_amount > 0 AND barter_description IS NULL)
            OR (payment_type = 'negotiable' AND price_amount IS NULL AND barter_description IS NULL)
            OR (payment_type = 'barter' AND price_amount IS NULL AND barter_description IS NOT NULL)
        )
);

ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_accepted_offer
    FOREIGN KEY (accepted_offer_id, id) REFERENCES task_offers (id, task_id);

CREATE TABLE offer_counter_offers (
    id BIGSERIAL PRIMARY KEY,
    offer_id BIGINT NOT NULL,
    author_user_id BIGINT NOT NULL,
    message TEXT,
    price_amount INTEGER,
    payment_type VARCHAR(30) NOT NULL,
    barter_description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_offer_counter_offers_offer
        FOREIGN KEY (offer_id) REFERENCES task_offers (id) ON DELETE CASCADE,
    CONSTRAINT fk_offer_counter_offers_author
        FOREIGN KEY (author_user_id) REFERENCES users (id),
    CONSTRAINT chk_offer_counter_offers_status
        CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
    CONSTRAINT chk_offer_counter_offers_payment
        CHECK (
            (payment_type = 'fixed_price' AND price_amount IS NOT NULL AND price_amount > 0 AND barter_description IS NULL)
            OR (payment_type = 'negotiable' AND price_amount IS NULL AND barter_description IS NULL)
            OR (payment_type = 'barter' AND price_amount IS NULL AND barter_description IS NOT NULL)
        )
);

CREATE TABLE task_assignments (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL UNIQUE,
    offer_id BIGINT NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    performer_id BIGINT NOT NULL,
    agreed_price_amount INTEGER,
    agreed_payment_type VARCHAR(30) NOT NULL,
    agreed_barter_description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'assigned',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_assignments_task
        FOREIGN KEY (task_id) REFERENCES tasks (id),
    CONSTRAINT fk_task_assignments_offer_for_task
        FOREIGN KEY (offer_id, task_id) REFERENCES task_offers (id, task_id),
    CONSTRAINT fk_task_assignments_customer
        FOREIGN KEY (customer_id) REFERENCES users (id),
    CONSTRAINT fk_task_assignments_performer
        FOREIGN KEY (performer_id) REFERENCES users (id),
    CONSTRAINT chk_task_assignments_status
        CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled', 'disputed')),
    CONSTRAINT chk_task_assignments_different_participants
        CHECK (customer_id <> performer_id),
    CONSTRAINT chk_task_assignments_payment
        CHECK (
            (agreed_payment_type = 'fixed_price' AND agreed_price_amount IS NOT NULL AND agreed_price_amount > 0 AND agreed_barter_description IS NULL)
            OR (agreed_payment_type = 'barter' AND agreed_price_amount IS NULL AND agreed_barter_description IS NOT NULL)
        )
);

CREATE TABLE task_completion_confirmations (
    id BIGSERIAL PRIMARY KEY,
    task_assignment_id BIGINT NOT NULL UNIQUE,
    customer_confirmed_at TIMESTAMPTZ,
    performer_confirmed_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    dispute_opened_by_user_id BIGINT,
    dispute_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_completion_confirmations_assignment
        FOREIGN KEY (task_assignment_id) REFERENCES task_assignments (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_completion_confirmations_dispute_user
        FOREIGN KEY (dispute_opened_by_user_id) REFERENCES users (id),
    CONSTRAINT chk_task_completion_confirmations_status
        CHECK (status IN ('pending', 'customer_confirmed', 'performer_confirmed', 'completed', 'disputed')),
    CONSTRAINT chk_task_completion_confirmations_dispute
        CHECK (
            (status = 'disputed' AND dispute_opened_by_user_id IS NOT NULL)
            OR (status <> 'disputed')
        )
);

CREATE TABLE task_chats (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    performer_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_chats_task
        FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_chats_customer
        FOREIGN KEY (customer_id) REFERENCES users (id),
    CONSTRAINT fk_task_chats_performer
        FOREIGN KEY (performer_id) REFERENCES users (id),
    CONSTRAINT chk_task_chats_different_participants
        CHECK (customer_id <> performer_id)
);

CREATE TABLE chat_messages (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text',
    body TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_messages_chat
        FOREIGN KEY (chat_id) REFERENCES task_chats (id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_messages_sender
        FOREIGN KEY (sender_id) REFERENCES users (id),
    CONSTRAINT chk_chat_messages_type
        CHECK (message_type IN ('text', 'system'))
);

CREATE TABLE reviews (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    task_assignment_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    target_user_id BIGINT NOT NULL,
    rating SMALLINT NOT NULL,
    comment TEXT,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reviews_task
        FOREIGN KEY (task_id) REFERENCES tasks (id),
    CONSTRAINT fk_reviews_task_assignment
        FOREIGN KEY (task_assignment_id) REFERENCES task_assignments (id),
    CONSTRAINT fk_reviews_author
        FOREIGN KEY (author_id) REFERENCES users (id),
    CONSTRAINT fk_reviews_target_user
        FOREIGN KEY (target_user_id) REFERENCES users (id),
    CONSTRAINT uq_reviews_assignment_author UNIQUE (task_assignment_id, author_id),
    CONSTRAINT chk_reviews_rating
        CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_reviews_author_target
        CHECK (author_id <> target_user_id),
    CONSTRAINT chk_reviews_moderation_status
        CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'hidden'))
);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id BIGINT,
    payload JSONB,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT chk_notifications_type
        CHECK (
            type IN (
                'offer_received',
                'offer_rejected',
                'offer_accepted',
                'counter_offer_received',
                'counter_offer_accepted',
                'counter_offer_rejected',
                'chat_message_received',
                'task_completed_requested',
                'task_completed_confirmed',
                'task_disputed',
                'review_received',
                'report_resolved'
            )
        )
);

CREATE TABLE notification_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    web_push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    offers_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    counter_offers_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    chat_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    task_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    reviews_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    moderation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_preferences_user
        FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE web_push_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_web_push_subscriptions_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT uq_web_push_subscriptions_user_endpoint UNIQUE (user_id, endpoint)
);

CREATE TABLE reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_id BIGINT NOT NULL,
    target_type VARCHAR(30) NOT NULL,
    target_id BIGINT NOT NULL,
    reason_code VARCHAR(50) NOT NULL,
    comment TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    resolved_by_user_id BIGINT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reports_reporter
        FOREIGN KEY (reporter_id) REFERENCES users (id),
    CONSTRAINT fk_reports_resolved_by
        FOREIGN KEY (resolved_by_user_id) REFERENCES users (id),
    CONSTRAINT chk_reports_target_type
        CHECK (target_type IN ('user', 'task', 'review', 'chat_message')),
    CONSTRAINT chk_reports_status
        CHECK (status IN ('pending', 'in_review', 'resolved', 'rejected'))
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_actor
        FOREIGN KEY (actor_user_id) REFERENCES users (id)
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);
CREATE INDEX idx_email_verification_codes_email_created_at ON email_verification_codes (email, created_at DESC);
CREATE INDEX idx_tasks_university_status_created_at ON tasks (university_id, status, created_at DESC);
CREATE INDEX idx_tasks_dormitory_status_created_at ON tasks (dormitory_id, status, created_at DESC);
CREATE INDEX idx_tasks_customer_created_at ON tasks (customer_id, created_at DESC);
CREATE INDEX idx_tasks_category_status ON tasks (category, status);
CREATE INDEX idx_tasks_created_at_desc ON tasks (created_at DESC);
CREATE INDEX idx_task_offers_performer_created_at ON task_offers (performer_id, created_at DESC);
CREATE INDEX idx_task_offers_task_status ON task_offers (task_id, status);
CREATE INDEX idx_task_offers_created_at_desc ON task_offers (created_at DESC);
CREATE INDEX idx_offer_counter_offers_offer_created_at ON offer_counter_offers (offer_id, created_at DESC);
CREATE INDEX idx_offer_counter_offers_created_at_desc ON offer_counter_offers (created_at DESC);
CREATE UNIQUE INDEX uq_offer_counter_offers_pending_per_offer
    ON offer_counter_offers (offer_id)
    WHERE status = 'pending';
CREATE INDEX idx_chat_messages_chat_created_at ON chat_messages (chat_id, created_at);
CREATE INDEX idx_chat_messages_sender_created_at ON chat_messages (sender_id, created_at);
CREATE INDEX idx_chat_messages_created_at_desc ON chat_messages (created_at DESC);
CREATE INDEX idx_reviews_target_user_created_at ON reviews (target_user_id, created_at DESC);
CREATE INDEX idx_reviews_created_at_desc ON reviews (created_at DESC);
CREATE INDEX idx_notifications_user_is_read_created_at ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_user_created_at ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_created_at_desc ON notifications (created_at DESC);
CREATE INDEX idx_reports_reporter_created_at ON reports (reporter_id, created_at DESC);
CREATE INDEX idx_reports_created_at_desc ON reports (created_at DESC);
CREATE INDEX idx_audit_logs_entity_created_at ON audit_logs (entity_type, entity_id, created_at DESC);
