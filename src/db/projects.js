import { db } from './database.js';

export function getProjects() {
  return db.prepare('SELECT * FROM projects ORDER BY id').all();
}

export function findProjectById(id) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

export function findProjectByLogin(login) {
  return db.prepare('SELECT * FROM projects WHERE login = ?').get(login);
}

export function findProjectByKey(keyHash) {
  return db.prepare('SELECT * FROM projects WHERE key_hash = ?').get(keyHash);
}

export function findProjectBySession(tokenHash) {
  return db.prepare(`
    SELECT projects.*
    FROM sessions
    JOIN projects ON projects.id = sessions.project_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now')
  `).get(tokenHash);
}

export function createProject({ name, url, login, passwordHash }) {
  const result = db.prepare('INSERT INTO projects (name, url, login, password_hash) VALUES (?, ?, ?, ?)')
    .run(name, url, login, passwordHash);
  return result.lastInsertRowid;
}

export function updateProject(id, { name, url }) {
  db.prepare('UPDATE projects SET name = ?, url = ? WHERE id = ?').run(name, url, id);
}

export function setProjectLogo(id, file) {
  db.prepare('UPDATE projects SET logo = ? WHERE id = ?').run(file, id);
}

export function setProjectContacts(id, { email, telegramId }) {
  db.prepare('UPDATE projects SET email = ?, telegram_id = ? WHERE id = ?').run(email || null, telegramId || null, id);
}

export function setProjectPassword(id, passwordHash) {
  db.transaction(() => {
    db.prepare('UPDATE projects SET password_hash = ? WHERE id = ?').run(passwordHash, id);
    db.prepare('DELETE FROM sessions WHERE project_id = ?').run(id);
  })();
}

export function setProjectKey(id, { keyHash, keyStart }) {
  db.prepare(`UPDATE projects SET key_hash = ?, key_start = ?, key_created_at = datetime('now'), key_used_at = NULL WHERE id = ?`)
    .run(keyHash, keyStart, id);
}

export function markProjectKeyUsed(id) {
  db.prepare(`UPDATE projects SET key_used_at = datetime('now') WHERE id = ?`).run(id);
}

export function deleteProject(id) {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

export function createSession({ tokenHash, projectId, days }) {
  db.prepare(`INSERT INTO sessions (token_hash, project_id, expires_at) VALUES (?, ?, datetime('now', ?))`)
    .run(tokenHash, projectId, `+${days} days`);
}

export function deleteSession(tokenHash) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function deleteExpiredSessions() {
  db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();
}
