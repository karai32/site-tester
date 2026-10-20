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

// file - путь к аватарке внутри папки media
export function setProjectLogo(id, file) {
  db.prepare('UPDATE projects SET logo = ? WHERE id = ?').run(file, id);
}

export function updateProject(id, { name, url }) {
  db.prepare('UPDATE projects SET name = ?, url = ? WHERE id = ?').run(name, url, id);
}

// Удаляет проект вместе со сценариями и отчётами (в базе это делает ON DELETE CASCADE)
export function deleteProject(id) {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}
