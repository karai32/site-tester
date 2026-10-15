// Расписание: когда подходит время, ставит в очередь отложенные и регулярные проверки.
// Вызывается очередью (queue.js) раз в несколько секунд.
import { createReport, hasUnfinishedReport } from '../db/reports.js';
import { cancelDeferredCheck, getDueDeferredScenarios, getDueRegularScenarios, setNextRunAt } from '../db/scenarios.js';
import { nextRunAt, scenarioSchedule, toUtcText } from '../schedule.js';

export function queueDueChecks(log) {
  // Отложенные проверки: запускаются один раз
  for (const scenario of getDueDeferredScenarios()) {
    const reportId = createReport({
      projectId: scenario.project_id,
      scenarioId: scenario.id,
      startedBy: scenario.deferred_by,
    });
    cancelDeferredCheck(scenario.id);
    log.info(`Отложенная проверка «${scenario.name}» поставлена в очередь, отчёт #${reportId}`);
  }

  // Регулярные проверки: ставим проверку и считаем следующий запуск
  for (const scenario of getDueRegularScenarios()) {
    // Прошлая проверка этого сценария ещё не закончилась — вторую в очередь не ставим
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
