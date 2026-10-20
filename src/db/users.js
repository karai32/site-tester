// Запросы к таблице users
import { db } from './database.js';

export function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// Все пользователи по алфавиту
export function getUsers() {
  return db.prepare('SELECT * FROM users ORDER BY name').all();
}

export function findUserByLogin(login) {
  return db.prepare('SELECT * FROM users WHERE login = ?').get(login);
}

// Возвращает id нового пользователя
export function createUser({ login, name, email, telegramId, passwordHash }) {
  const result = db
    .prepare('INSERT INTO users (login, name, email, telegram_id, password_hash) VALUES (?, ?, ?, ?, ?)')
    .run(login, name, email || null, telegramId || null, passwordHash);
  return result.lastInsertRowid;
}

// Новый пароль. Все сессии пользователя закрываются: войти можно только с новым паролем.
export function updatePassword(userId, passwordHash) {
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  })();
}

// Контакты для уведомлений: почта и Telegram ID (пустые - null)
export function updateUserContacts(userId, { email, telegramId }) {
  db.prepare('UPDATE users SET email = ?, telegram_id = ? WHERE id = ?').run(email || null, telegramId || null, userId);
}

export function updateUser(userId, { name, email, telegramId }) {
  db.prepare('UPDATE users SET name = ?, email = ?, telegram_id = ? WHERE id = ?')
    .run(name, email || null, telegramId || null, userId);
}

// Удаляет пользователя. Его сессии и API-ключи удаляются, у сценариев и отчётов автор становится пустым.
export function deleteUser(userId) {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}
