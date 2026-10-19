// Данные дашборда проекта. Общие для страницы проекта (routes/projects.js) и API (api/projects.js).
import { findLatestDoneReport, getRecentReports, getReportResults } from './db/reports.js';
import { getProjectScenarios } from './db/scenarios.js';
import { groupByCategory } from './report-summary.js';
import { upcomingRuns } from './schedule.js';
import { scenarioSummary } from './scenario-info.js';

const UPCOMING_COUNT = 5; // сколько ближайших проверок показывать (по ТЗ — 5)
const RECENT_COUNT = 10; // сколько последних отчётов показывать (по ТЗ — 10)

// { allScenarios, scenarios, upcoming, lastFull, lastFullCategories, lastPartial, recentReports }
export function dashboardData(projectId) {
  // Активные сценарии и их состав — для запуска проверки
  const allScenarios = getProjectScenarios(projectId);
  const scenarios = [];
  for (const scenario of allScenarios) {
    if (scenario.is_active) scenarios.push({ ...scenario, summary: scenarioSummary(scenario) });
  }

  // Ближайшие проверки: отложенные и регулярные всех активных сценариев, по времени
  let upcoming = [];
  for (const scenario of scenarios) {
    upcoming.push(...upcomingRuns(scenario, UPCOMING_COUNT));
  }
  upcoming.sort((a, b) => a.runAt.localeCompare(b.runAt));
  upcoming = upcoming.slice(0, UPCOMING_COUNT);

  const lastFull = findLatestDoneReport(projectId, true);
  const lastPartial = findLatestDoneReport(projectId, false);

  // Плитки категорий для сводки по последней полной проверке
  let lastFullCategories = [];
  if (lastFull) lastFullCategories = groupByCategory(getReportResults(lastFull.id));

  return {
    allScenarios,
    scenarios,
    upcoming,
    lastFull,
    lastFullCategories,
    lastPartial,
    recentReports: getRecentReports(projectId, RECENT_COUNT),
  };
}
