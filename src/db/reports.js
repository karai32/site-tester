import { db } from './database.js';

export function findReportById(id) {
  return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
}

const reportsWithNames = `
  SELECT reports.*,
         scenarios.name     AS scenario_name,
         scenarios.is_full  AS scenario_is_full,
         starters.name      AS started_by_name,
         scenarios.author_id AS scenario_author_id,
         authors.name       AS scenario_author_name
  FROM reports
  JOIN scenarios ON scenarios.id = reports.scenario_id
  LEFT JOIN users AS starters ON starters.id = reports.started_by
  LEFT JOIN users AS authors ON authors.id = scenarios.author_id
`;

export function findReportWithNames(id) {
  return db.prepare(`${reportsWithNames} WHERE reports.id = ?`).get(id);
}

export function getProjectReports(projectId) {
  return db.prepare(`${reportsWithNames} WHERE reports.project_id = ? ORDER BY reports.id DESC`).all(projectId);
}

export function getScenarioReports(scenarioId) {
  return db.prepare(`${reportsWithNames} WHERE reports.scenario_id = ? ORDER BY reports.id DESC`).all(scenarioId);
}

export function getRecentReports(projectId, limit) {
  return db.prepare(`${reportsWithNames} WHERE reports.project_id = ? ORDER BY reports.id DESC LIMIT ?`).all(projectId, limit);
}

export function findLatestDoneReport(projectId, isFull) {
  return db.prepare(`
    ${reportsWithNames}
    WHERE reports.project_id = ? AND reports.status = 'done' AND scenarios.is_full = ?
    ORDER BY reports.id DESC LIMIT 1
  `).get(projectId, isFull ? 1 : 0);
}

export function findPreviousDoneReport(scenarioId, reportId) {
  return db.prepare(`
    SELECT * FROM reports
    WHERE scenario_id = ? AND id < ? AND status = 'done'
    ORDER BY id DESC LIMIT 1
  `).get(scenarioId, reportId);
}

export function createReport({ projectId, scenarioId, startedBy, isRegular = false }) {
  const result = db.prepare('INSERT INTO reports (project_id, scenario_id, started_by, is_regular) VALUES (?, ?, ?, ?)')
    .run(projectId, scenarioId, startedBy ?? null, isRegular ? 1 : 0);
  return result.lastInsertRowid;
}

export function hasUnfinishedReport(scenarioId) {
  const row = db.prepare(`SELECT 1 FROM reports WHERE scenario_id = ? AND status IN ('queued', 'running') LIMIT 1`).get(scenarioId);
  return Boolean(row);
}

export function isCheckRunning() {
  return Boolean(db.prepare(`SELECT 1 FROM reports WHERE status = 'running' LIMIT 1`).get());
}

export function findNextQueuedReport() {
  return db.prepare(`SELECT * FROM reports WHERE status = 'queued' ORDER BY id LIMIT 1`).get();
}

export function markReportRunning(id) {
  const result = db.prepare(`
    UPDATE reports SET status = 'running', started_at = datetime('now')
    WHERE id = ? AND status = 'queued'
  `).run(id);
  return result.changes === 1;
}

export function setReportPlan(id, { pagesCount, sitePagesCount, testsTotal, note }) {
  db.prepare('UPDATE reports SET pages_count = ?, site_pages_count = ?, tests_total = ?, note = ? WHERE id = ?')
    .run(pagesCount, sitePagesCount, testsTotal, note ?? null, id);
}

export function markReportDone(id) {
  db.prepare(`UPDATE reports SET status = 'done', finished_at = datetime('now') WHERE id = ? AND status = 'running'`).run(id);
}

export function markReportError(id, error) {
  db.prepare(`UPDATE reports SET status = 'error', error = ?, finished_at = datetime('now') WHERE id = ? AND status IN ('queued', 'running')`).run(error, id);
}

export function cancelReport(id) {
  db.prepare(`UPDATE reports SET status = 'cancelled', finished_at = datetime('now') WHERE id = ? AND status IN ('queued', 'running')`).run(id);
}

export function isReportCancelled(id) {
  const report = db.prepare('SELECT status FROM reports WHERE id = ?').get(id);
  return Boolean(report) && report.status === 'cancelled';
}

export function markInterruptedReports() {
  db.prepare(`
    UPDATE reports SET status = 'error', error = 'Проверка прервана: сервер был перезапущен', finished_at = datetime('now')
    WHERE status = 'running'
  `).run();
}

export function saveTestResult(reportId, result) {
  db.transaction(() => {
    db.prepare(`
      INSERT INTO report_results
        (report_id, category_id, category_title, test_id, test_title, passed, comment, problems, pages, media, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId,
      result.categoryId,
      result.categoryTitle,
      result.testId,
      result.testTitle,
      result.passed ? 1 : 0,
      result.comment ?? null,
      JSON.stringify(result.problems),
      JSON.stringify(result.pages),
      JSON.stringify(result.media),
      result.durationMs,
    );
    db.prepare('UPDATE reports SET tests_done = tests_done + 1, tests_passed = tests_passed + ? WHERE id = ?')
      .run(result.passed ? 1 : 0, reportId);
  })();
}

export function getReportResults(reportId) {
  const rows = db.prepare('SELECT * FROM report_results WHERE report_id = ? ORDER BY id').all(reportId);
  for (const row of rows) {
    row.problems = JSON.parse(row.problems);
    row.pages = JSON.parse(row.pages);
    row.media = JSON.parse(row.media);
  }
  return rows;
}
