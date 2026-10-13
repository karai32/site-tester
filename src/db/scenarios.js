// Запросы к таблице scenarios.
// Поля test_ids и page_sets в базе — JSON-текст, наружу отдаются массивами.
import { db } from './database.js';

function parseScenario(row) {
  if (!row) return undefined;
  return { ...row, test_ids: JSON.parse(row.test_ids), page_sets: JSON.parse(row.page_sets) };
}

export function findScenarioById(id) {
  return parseScenario(db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id));
}

// Сценарии проекта вместе с именем автора
export function getProjectScenarios(projectId) {
  return db.prepare(`
    SELECT scenarios.*, users.name AS author_name
    FROM scenarios
    LEFT JOIN users ON users.id = scenarios.author_id
    WHERE scenarios.project_id = ?
    ORDER BY scenarios.id
  `).all(projectId).map(parseScenario);
}

// Возвращает id нового сценария
export function createScenario({ projectId, authorId, name, isFull = false, testIds = [], pageSets = [] }) {
  const result = db.prepare(`
    INSERT INTO scenarios (project_id, author_id, name, is_full, test_ids, page_sets)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(projectId, authorId ?? null, name, isFull ? 1 : 0, JSON.stringify(testIds), JSON.stringify(pageSets));
  return result.lastInsertRowid;
}
