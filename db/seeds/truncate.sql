-- =============================================================================
-- DormEX truncate script
-- Removes all user-generated data but keeps universities and dormitories.
-- Run via:  psql "$DATABASE_URL" -f db/seeds/truncate.sql
-- =============================================================================

BEGIN;

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
    users
RESTART IDENTITY CASCADE;

COMMIT;
