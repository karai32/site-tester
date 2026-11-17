import { db } from './database.js';

export function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUsers() {
  return db.prepare('SELECT * FROM users ORDER BY name').all();
}

export function findUserByLogin(login) {
  return db.prepare('SELECT * FROM users WHERE login = ?').get(login);
}

export function createUser({ login, name, email, telegramId, passwordHash }) {
  const result = db
    .prepare('INSERT INTO users (login, name, email, telegram_id, password_hash) VALUES (?, ?, ?, ?, ?)')
    .run(login, name, email || null, telegramId || null, passwordHash);
  return result.lastInsertRowid;
}

export function updatePassword(userId, passwordHash) {
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  })();
}

export function updateUserContacts(userId, { email, telegramId }) {
  db.prepare('UPDATE users SET email = ?, telegram_id = ? WHERE id = ?').run(email || null, telegramId || null, userId);
}

export function updateUser(userId, { name, email, telegramId }) {
  db.prepare('UPDATE users SET name = ?, email = ?, telegram_id = ? WHERE id = ?')
    .run(name, email || null, telegramId || null, userId);
}

export function deleteUser(userId) {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

export function createSession({ tokenHash, userId, days }) {
  db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`)
    .run(tokenHash, userId, `+${days} days`);
}

export function findUserBySession(tokenHash) {
  return db.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now')
  `).get(tokenHash);
}

export function deleteSession(tokenHash) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function deleteExpiredSessions() {
  db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();
}

export function createApiKey({ userId, name, keyHash, keyStart }) {
  const result = db.prepare('INSERT INTO api_keys (user_id, name, key_hash, key_start) VALUES (?, ?, ?, ?)')
    .run(userId, name, keyHash, keyStart);
  return result.lastInsertRowid;
}

export function getUserApiKeys(userId) {
  return db.prepare('SELECT * FROM api_keys WHERE user_id = ? ORDER BY id DESC').all(userId);
}

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

export function deleteApiKey(id, userId) {
  db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(id, userId);
}
