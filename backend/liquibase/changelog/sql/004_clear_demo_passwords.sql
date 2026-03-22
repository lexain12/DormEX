UPDATE users
SET password_hash = NULL
WHERE email LIKE '%@campus.test';
