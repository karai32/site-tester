// Запросы к таблице projects
import { db } from './database.js';

export function getProjects() {
  return db.prepare('SELECT * FROM projects ORDER BY name').all();
}

export function findProjectById(id) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

// Возвращает id нового проекта
export function createProject({ name, url }) {
  const result = db.prepare('INSERT INTO projects (name, url) VALUES (?, ?)').run(name, url);
  return result.lastInsertRowid;
}
