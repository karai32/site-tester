import { createReport, hasUnfinishedReport } from '../db/reports.js';
import { cancelDeferredCheck, getDueDeferredScenarios, getDueRegularScenarios, setNextRunAt } from '../db/scenarios.js';
import { nextRunAt, scenarioSchedule, toUtcText } from '../schedule.js';

export function queueDueChecks(log) {
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
