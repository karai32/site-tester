// Запросы к таблицам reports и report_results.
// Статусы отчёта: queued — ждёт в очереди, running — идёт, done — готов, error — не выполнился.
import { db } from './database.js';

export function findReportById(id) {
  return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
}

// Ставит проверку в очередь. Возвращает id отчёта.
export function createReport({ projectId, scenarioId, startedBy }) {
  const result = db.prepare('INSERT INTO reports (project_id, scenario_id, started_by) VALUES (?, ?, ?)')
    .run(projectId, scenarioId, startedBy ?? null);
  return result.lastInsertRowid;
}

// Самый старый отчёт в очереди
export function findNextQueuedReport() {
  return db.prepare(`SELECT * FROM reports WHERE status = 'queued' ORDER BY id LIMIT 1`).get();
}

// Переводит отчёт из очереди в работу. Возвращает false, если его уже взял кто-то другой.
export function markReportRunning(id) {
  const result = db.prepare(`
    UPDATE reports SET status = 'running', started_at = datetime('now')
    WHERE id = ? AND status = 'queued'
  `).run(id);
  return result.changes === 1;
}

export function setReportPlan(id, { pagesCount, testsTotal, note }) {
  db.prepare('UPDATE reports SET pages_count = ?, tests_total = ?, note = ? WHERE id = ?')
    .run(pagesCount, testsTotal, note ?? null, id);
}

export function markReportDone(id) {
  db.prepare(`UPDATE reports SET status = 'done', finished_at = datetime('now') WHERE id = ?`).run(id);
}

export function markReportError(id, error) {
  db.prepare(`UPDATE reports SET status = 'error', error = ?, finished_at = datetime('now') WHERE id = ?`).run(error, id);
}

// После перезапуска сервера проверки, которые шли, уже не продолжатся
export function markInterruptedReports() {
  db.prepare(`
    UPDATE reports SET status = 'error', error = 'Проверка прервана: сервер был перезапущен', finished_at = datetime('now')
    WHERE status = 'running'
  `).run();
}

// Сохраняет результат теста и обновляет счётчики отчёта
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
  return db.prepare('SELECT * FROM report_results WHERE report_id = ? ORDER BY id').all(reportId).map((row) => ({
    ...row,
    problems: JSON.parse(row.problems),
    pages: JSON.parse(row.pages),
    media: JSON.parse(row.media),
  }));
}
