// Запросы к таблице sessions
import { db } from './database.js';

export function createSession({ tokenHash, userId, days }) {
  db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`)
    .run(tokenHash, userId, `+${days} days`);
}

// Пользователь, которому принадлежит сессия, если она ещё не истекла
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
