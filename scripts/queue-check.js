// Ставит проверку по сценарию в очередь. Её выполнит запущенный сервер.
// Запуск: npm run queue-check -- <id сценария>
// Проверки по расписанию ставит сам сервер (src/runner/scheduler.js), эта команда — для ручного запуска.
import { createReport } from '../src/db/reports.js';
import { findScenarioById } from '../src/db/scenarios.js';

const scenario = findScenarioById(Number(process.argv[2]));
if (!scenario) {
  console.error('Укажите id сценария: npm run queue-check -- 1');
  process.exit(1);
}

const reportId = createReport({ projectId: scenario.project_id, scenarioId: scenario.id });
console.log(`Проверка «${scenario.name}» поставлена в очередь, отчёт #${reportId}`);
