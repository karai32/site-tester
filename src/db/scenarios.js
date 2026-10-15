// Запросы к таблице scenarios.
// Поля test_ids и page_sets в базе — JSON-текст, наружу отдаются массивами,
// notifications — объектом настроек (см. src/notifications/settings.js).
import { defaultNotifications, parseNotifications } from '../notifications/settings.js';
import { db } from './database.js';

// Списки хранятся в базе как JSON-текст — превращаем их обратно в массивы
function parseScenario(row) {
  if (!row) return undefined;
  row.test_ids = JSON.parse(row.test_ids);
  row.page_sets = JSON.parse(row.page_sets);
  row.notifications = parseNotifications(row.notifications);
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

// Возвращает id нового сценария. schedule — регулярность, см. src/schedule.js
// (по умолчанию нерегулярный), nextRunAt — когда первый регулярный запуск (UTC-текст).
export function createScenario({
  projectId,
  authorId,
  name,
  isFull = false,
  testIds = [],
  pageSets = [],
  rootId = null,
  revision = 1,
  schedule = { type: null, time: null, number: null },
  nextRunAt = null,
  notifications = defaultNotifications(null),
}) {
  const result = db.prepare(`
    INSERT INTO scenarios (project_id, author_id, name, is_full, test_ids, page_sets, root_id, revision,
                           schedule_type, schedule_time, schedule_number, next_run_at, notifications)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    authorId ?? null,
    name,
    isFull ? 1 : 0,
    JSON.stringify(testIds),
    JSON.stringify(pageSets),
    rootId,
    revision,
    schedule.type,
    schedule.time,
    schedule.number,
    nextRunAt,
    JSON.stringify(notifications),
  );
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

// --- Регулярные и отложенные проверки ---

// Новая регулярность сценария. nextRunAt — когда первый запуск (UTC-текст), у нерегулярного null.
export function setScenarioSchedule(id, schedule, nextRunAt) {
  db.prepare('UPDATE scenarios SET schedule_type = ?, schedule_time = ?, schedule_number = ?, next_run_at = ? WHERE id = ?')
    .run(schedule.type, schedule.time, schedule.number, nextRunAt, id);
}

export function setNextRunAt(id, nextRunAt) {
  db.prepare('UPDATE scenarios SET next_run_at = ? WHERE id = ?').run(nextRunAt, id);
}

export function setScenarioNotifications(id, notifications) {
  db.prepare('UPDATE scenarios SET notifications = ? WHERE id = ?').run(JSON.stringify(notifications), id);
}

// Отложенная проверка: когда (UTC-текст) и кто её поставил
export function setDeferredCheck(id, runAt, userId) {
  db.prepare('UPDATE scenarios SET deferred_at = ?, deferred_by = ? WHERE id = ?').run(runAt, userId, id);
}

export function cancelDeferredCheck(id) {
  db.prepare('UPDATE scenarios SET deferred_at = NULL, deferred_by = NULL WHERE id = ?').run(id);
}

// Активные сценарии, у которых подошло время отложенной проверки
export function getDueDeferredScenarios() {
  return db.prepare(`SELECT * FROM scenarios WHERE is_active = 1 AND deferred_at <= datetime('now')`).all();
}

// Активные регулярные сценарии, у которых подошло время следующего запуска
export function getDueRegularScenarios() {
  return db.prepare(`
    SELECT * FROM scenarios
    WHERE is_active = 1 AND schedule_type IS NOT NULL AND next_run_at <= datetime('now')
  `).all();
}
