-- API-ключи: по ним сторонняя админка работает с сервисом через /api/v1.
-- Как и у сессий, хранится не сам ключ, а его хеш. Запросы с ключом идут от имени его владельца.
CREATE TABLE api_keys (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- владелец; удалили пользователя — удалились ключи
  name         TEXT NOT NULL,         -- для чего ключ, например «Админка 808»
  key_hash     TEXT NOT NULL UNIQUE,  -- sha256 ключа
  key_start    TEXT NOT NULL,         -- первые символы ключа, чтобы узнать его в списке: «808ck_k3J9»
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT                   -- когда ключ последний раз использовали
);
