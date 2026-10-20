// Запросы к таблице api_keys
import { db } from './database.js';

export function createApiKey({ userId, name, keyHash, keyStart }) {
  const result = db.prepare('INSERT INTO api_keys (user_id, name, key_hash, key_start) VALUES (?, ?, ?, ?)')
    .run(userId, name, keyHash, keyStart);
  return result.lastInsertRowid;
}

// Ключи пользователя, новые сверху
export function getUserApiKeys(userId) {
  return db.prepare('SELECT * FROM api_keys WHERE user_id = ? ORDER BY id DESC').all(userId);
}

// Владелец ключа по хешу ключа (или undefined) и id ключа - в поле api_key_id
export function findUserByApiKey(keyHash) {
  return db.prepare(`
    SELECT users.*, api_keys.id AS api_key_id
    FROM api_keys
    JOIN users ON users.id = api_keys.user_id
    WHERE api_keys.key_hash = ?
  `).get(keyHash);
}

export function markApiKeyUsed(id) {
  db.prepare(`UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`).run(id);
}

// Удалить можно только свой ключ
export function deleteApiKey(id, userId) {
  db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(id, userId);
}
