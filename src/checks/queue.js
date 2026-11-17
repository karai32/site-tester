import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '../config.js';
import { createReport, findNextQueuedReport, hasUnfinishedReport, markInterruptedReports } from '../db/reports.js';
import { cancelDeferredCheck, getDueDeferredScenarios, getDueRegularScenarios, setNextRunAt } from '../db/scenarios.js';
import { nextRunAt, scenarioSchedule, toUtcText } from '../logic/schedule.js';
import { runCheck } from './run-check.js';

const CHECK_EVERY_MS = 5000;
let busy = false;

function queueDueChecks(log) {
  for (const scenario of getDueDeferredScenarios()) {
    const reportId = createReport({
      projectId: scenario.project_id,
      scenarioId: scenario.id,
      startedBy: scenario.deferred_by,
    });
    cancelDeferredCheck(scenario.id);
    log.info(`Отложенная проверка «${scenario.name}» поставлена в очередь, отчёт #${reportId}`);
  }

  for (const scenario of getDueRegularScenarios()) {
    if (hasUnfinishedReport(scenario.id)) {
      log.info(`Регулярная проверка «${scenario.name}» пропущена: прошлая ещё не закончилась`);
    } else {
      const reportId = createReport({
        projectId: scenario.project_id,
        scenarioId: scenario.id,
        isRegular: true,
      });
      log.info(`Регулярная проверка «${scenario.name}» поставлена в очередь, отчёт #${reportId}`);
    }

    const next = nextRunAt(scenarioSchedule(scenario), new Date());
    setNextRunAt(scenario.id, toUtcText(next));
  }
}

export function startQueue(log) {
  markInterruptedReports();
  rmSync(join(DATA_DIR, 'cache'), { recursive: true, force: true });

  setInterval(async () => {
    try {
      queueDueChecks(log);
    } catch (error) {
      log.error(error, 'Не удалось поставить проверки по расписанию');
    }

    if (busy) return;
    const report = findNextQueuedReport();
    if (!report) return;

    busy = true;
    try {
      await runCheck(report.id, log);
    } finally {
      busy = false;
    }
  }, CHECK_EVERY_MS);
}
