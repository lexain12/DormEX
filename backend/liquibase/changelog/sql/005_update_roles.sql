--liquibase formatted sql

--changeset codex:003-update-user-roles
-- Drop the old check constraint before rewriting existing role values.
ALTER TABLE users DROP CONSTRAINT chk_users_role;

-- Update existing 'student' roles to 'user'
UPDATE users SET role = 'user' WHERE role = 'student';

-- Update existing 'moderator' roles to 'admin' (assuming moderators become admins)
UPDATE users SET role = 'admin' WHERE role = 'moderator';

-- Add new check constraint with 'user' and 'admin'
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('user', 'admin'));

-- Update default role to 'user'
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
