ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username VARCHAR(100),
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

UPDATE users
SET username = split_part(email, '@', 1)
WHERE username IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users (username);
