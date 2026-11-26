import { defaultNotifications, parseNotifications } from '../logic/notifications.js';
import { db } from './database.js';

function parseScenario(row) {
  if (!row) return undefined;
  row.test_ids = JSON.parse(row.test_ids);
  row.page_sets = JSON.parse(row.page_sets);
  row.notifications = parseNotifications(row.notifications);
  return row;
}

export function findScenarioById(id) {
  return parseScenario(db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id));
}

export function getProjectScenarios(projectId) {
  return db.prepare('SELECT * FROM scenarios WHERE project_id = ? ORDER BY id').all(projectId).map(parseScenario);
}

export function createScenario({
  projectId,
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
    INSERT INTO scenarios (project_id, name, is_full, test_ids, page_sets, root_id, revision,
                           schedule_type, schedule_time, schedule_number, next_run_at, notifications)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
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

export function nextRevision(rootId) {
  const row = db.prepare('SELECT MAX(revision) AS last FROM scenarios WHERE id = ? OR root_id = ?').get(rootId, rootId);
  return (row.last || 1) + 1;
}

export function setScenarioActive(id, isActive) {
  db.prepare('UPDATE scenarios SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
}

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

export function setDeferredCheck(id, runAt) {
  db.prepare('UPDATE scenarios SET deferred_at = ? WHERE id = ?').run(runAt, id);
}

export function cancelDeferredCheck(id) {
  db.prepare('UPDATE scenarios SET deferred_at = NULL WHERE id = ?').run(id);
}

export function getDueDeferredScenarios() {
  return db.prepare(`SELECT * FROM scenarios WHERE is_active = 1 AND deferred_at <= datetime('now')`).all();
}

export function getDueRegularScenarios() {
  return db.prepare(`
    SELECT * FROM scenarios
    WHERE is_active = 1 AND schedule_type IS NOT NULL AND next_run_at <= datetime('now')
  `).all();
}
