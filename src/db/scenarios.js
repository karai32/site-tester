// Запросы к таблице scenarios.
// Поля test_ids и page_sets в базе — JSON-текст, наружу отдаются массивами.
import { db } from './database.js';

// Списки хранятся в базе как JSON-текст — превращаем их обратно в массивы
function parseScenario(row) {
  if (!row) return undefined;
  row.test_ids = JSON.parse(row.test_ids);
  row.page_sets = JSON.parse(row.page_sets);
  return row;
}

// Сценарий вместе с именем автора
const scenariosWithAuthor = `
  SELECT scenarios.*, users.name AS author_name
  FROM scenarios
  LEFT JOIN users ON users.id = scenarios.author_id
`;

export function findScenarioById(id) {
  return parseScenario(db.prepare(`${scenariosWithAuthor} WHERE scenarios.id = ?`).get(id));
}

// Сценарии проекта, старые сверху
export function getProjectScenarios(projectId) {
  return db.prepare(`${scenariosWithAuthor} WHERE scenarios.project_id = ? ORDER BY scenarios.id`)
    .all(projectId).map(parseScenario);
}

// Возвращает id нового сценария
export function createScenario({ projectId, authorId, name, isFull = false, testIds = [], pageSets = [], rootId = null, revision = 1 }) {
  const result = db.prepare(`
    INSERT INTO scenarios (project_id, author_id, name, is_full, test_ids, page_sets, root_id, revision)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, authorId ?? null, name, isFull ? 1 : 0, JSON.stringify(testIds), JSON.stringify(pageSets), rootId, revision);
  return result.lastInsertRowid;
}

// Номер следующей редакции: на 1 больше самой новой в семействе сценария
export function nextRevision(rootId) {
  const row = db.prepare('SELECT MAX(revision) AS last FROM scenarios WHERE id = ? OR root_id = ?').get(rootId, rootId);
  return (row.last || 1) + 1;
}

export function setScenarioActive(id, isActive) {
  db.prepare('UPDATE scenarios SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
}
