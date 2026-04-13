-- Local dev seed: login sumit.somanchd@gmail.com / Test@123
INSERT OR REPLACE INTO users (id, email, password_hash, name, currency, avatar_mime, avatar_blob, created_at, updated_at)
VALUES (
  'sumitdevuser001',
  'sumit.somanchd@gmail.com',
  '$2a$10$xR5heewF6XioXMSZIUvZZ.KxzKfZS4Hd0JckBmjRIPCKrqBvDZiGC',
  'Sumit',
  'USD',
  NULL,
  NULL,
  datetime('now'),
  datetime('now')
);
