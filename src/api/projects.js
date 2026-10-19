// Проекты: список и проект с данными дашборда
import { dashboardData } from '../dashboard.js';
import { findProjectById, getProjects } from '../db/projects.js';
import { listScenarios } from '../scenario-list.js';
import { formatProject, formatReport, formatScenarioItem, isoDate } from './format.js';
import { sendData, sendError } from './response.js';

export default async function projectsApi(app) {
  app.get('/projects', async (_request, reply) => {
    return sendData(reply, getProjects().map(formatProject));
  });

  // Проект и всё, что на его дашборде: сценарии для запуска, ближайшие проверки,
  // последняя полная и частичная проверки, последние отчёты
  app.get('/projects/:id', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return sendError(reply, 404, 'not_found', 'Проект не найден');

    const data = dashboardData(project.id);
    const activeScenarios = listScenarios(project.id, {
      inactive: false,
      author: '',
      categories: [],
      regular: '',
      sort: 'old',
    }).scenarios;

    let lastFullReport = null;
    if (data.lastFull) {
      // Итог по категориям — плитки «2/4 Безопасность»
      const categories = data.lastFullCategories.map((category) => ({
        id: category.id,
        title: category.title,
        shortTitle: category.shortTitle,
        passedCount: category.passedCount,
        testsCount: category.results.length,
      }));
      lastFullReport = { ...formatReport(data.lastFull), categories };
    }

    let lastPartialReport = null;
    if (data.lastPartial) lastPartialReport = formatReport(data.lastPartial);

    const upcoming = data.upcoming.map((run) => ({
      scenarioId: run.scenario.id,
      scenarioName: run.scenario.name,
      runAt: isoDate(run.runAt),
      isRegular: run.isRegular, // false — отложенная проверка
    }));

    return sendData(reply, {
      project: formatProject(project),
      // Активные сценарии в порядке создания — их можно запустить.
      // Список с фильтрами и неактивными — /projects/:id/scenarios
      scenarios: activeScenarios.map(formatScenarioItem),
      upcoming,
      lastFullReport,
      lastPartialReport,
      recentReports: data.recentReports.map(formatReport),
    });
  });
}
