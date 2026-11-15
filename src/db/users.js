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
