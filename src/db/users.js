// Запросы к таблице users
import { db } from './database.js';

export function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function findUserByLogin(login) {
  return db.prepare('SELECT * FROM users WHERE login = ?').get(login);
}

// Возвращает id нового пользователя
export function createUser({ login, name, email, passwordHash }) {
  const result = db
    .prepare('INSERT INTO users (login, name, email, password_hash) VALUES (?, ?, ?, ?)')
    .run(login, name, email || null, passwordHash);
  return result.lastInsertRowid;
}

// Новый пароль. Все сессии пользователя закрываются: войти можно только с новым паролем.
export function updatePassword(userId, passwordHash) {
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  })();
}
