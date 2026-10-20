// Запускает проверку по сценарию прямо в терминале и печатает итог.
// Запуск: npm run check -- <id сценария>
// Пока идёт проверка, не запускайте сервер: он сочтёт её прерванной.
import { createReport, findReportById, getReportResults, markReportError } from '../src/db/reports.js';
import { findScenarioById } from '../src/db/scenarios.js';
import { runCheck } from '../src/runner/run-check.js';

const scenarioId = Number(process.argv[2]);
const scenario = findScenarioById(scenarioId);
if (!scenario) {
  console.error('Укажите id сценария: npm run check -- 1');
  process.exit(1);
}

const reportId = createReport({ projectId: scenario.project_id, scenarioId });

// Ctrl+C: отмечаем отчёт прерванным и выходим
process.on('SIGINT', () => {
  markReportError(reportId, 'Проверка прервана из терминала');
  process.exit(1);
});

await runCheck(reportId);

const report = findReportById(reportId);
if (report.status === 'error') {
  console.log(`\nПроверка не выполнена: ${report.error}`);
  process.exit(1);
}

console.log(`\nОтчёт #${reportId}: успешно ${report.tests_passed} из ${report.tests_total}, страниц в выборке: ${report.pages_count}`);
if (report.note) console.log(report.note);
for (const result of getReportResults(reportId)) {
  console.log(`${result.passed ? '✓' : '✗'} ${result.test_id} - ${result.comment}`);
}
