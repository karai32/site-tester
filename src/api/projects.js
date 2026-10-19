// Проекты: список, проект с данными дашборда, создание, изменение, удаление, аватарка
import { dashboardData } from '../dashboard.js';
import { findProjectById, getProjects, updateProject } from '../db/projects.js';
import { getProjectReports } from '../db/reports.js';
import { cleanProject, createProjectWithScenario, deleteProjectWithFiles, saveProjectLogo } from '../project-actions.js';
import { listScenarios } from '../scenario-list.js';
import { formatProject, formatReport, formatScenarioItem, isoDate } from './format.js';
import { hasErrors, sendData, sendError, sendValidationErrors, valueOrCurrent } from './response.js';

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

  // Новый проект: { name, url }. Вместе с ним создаётся сценарий «Полная проверка».
  app.post('/projects', async (request, reply) => {
    const { project, errors } = cleanProject(request.body || {});
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    const projectId = createProjectWithScenario(project);
    reply.code(201);
    return sendData(reply, formatProject(findProjectById(projectId)));
  });

  // Изменение: { name?, url? } — непереданные поля не меняются
  app.patch('/projects/:id', async (request, reply) => {
    const current = findProjectById(request.params.id);
    if (!current) return sendError(reply, 404, 'not_found', 'Проект не найден');

    const body = request.body || {};
    const { project, errors } = cleanProject({
      name: valueOrCurrent(body, 'name', current.name),
      url: valueOrCurrent(body, 'url', current.url),
    });
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    updateProject(current.id, project);
    return sendData(reply, formatProject(findProjectById(current.id)));
  });

  // Удаление проекта со всеми сценариями, отчётами и скриншотами. Отменить нельзя.
  app.delete('/projects/:id', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return sendError(reply, 404, 'not_found', 'Проект не найден');

    // Идущая проверка пишет результаты в отчёт проекта — удалять его посреди проверки нельзя
    const running = getProjectReports(project.id).some((report) => report.status === 'running');
    if (running) {
      return sendError(reply, 409, 'conflict', 'Сейчас идёт проверка этого проекта: отмените её или дождитесь конца');
    }

    deleteProjectWithFiles(project);
    return sendData(reply, { deleted: true });
  });

  // Аватарка: файл PNG, JPEG или WebP до 2 МБ в поле формы (multipart/form-data)
  app.post('/projects/:id/logo', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return sendError(reply, 404, 'not_found', 'Проект не найден');
    const error = { logo: 'Нужна картинка PNG, JPEG или WebP не больше 2 МБ, отправленная как multipart/form-data' };

    let data;
    try {
      const file = await request.file();
      if (!file) return sendValidationErrors(reply, error);
      data = await file.toBuffer();
    } catch {
      return sendValidationErrors(reply, error); // не multipart или файл больше 2 МБ
    }

    if (!saveProjectLogo(project, data)) return sendValidationErrors(reply, error);
    return sendData(reply, formatProject(findProjectById(project.id)));
  });
}
