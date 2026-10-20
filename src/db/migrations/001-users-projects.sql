-- Пользователи, сессии и проекты.
-- Даты хранятся в UTC в формате 'YYYY-MM-DD HH:MM:SS'.

-- Пользователи сервиса
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  login         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  email         TEXT,
  telegram_id   TEXT,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Сессии: кто сейчас вошёл в сервис.
-- В cookie браузера лежит случайный токен, здесь - его хеш.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

-- Проекты: сайты, которые проверяет сервис
CREATE TABLE IF NOT EXISTS projects (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
