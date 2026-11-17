import { findProjectById, getProjects, updateProject } from '../db/projects.js';
import { getProjectReports } from '../db/reports.js';
import {
  cleanProject,
  createProjectWithScenario,
  dashboardData,
  deleteProjectWithFiles,
  saveProjectLogo,
} from '../logic/projects.js';
import { listScenarios } from '../logic/scenarios.js';
import {
  formatProject,
  formatReport,
  formatScenarioItem,
  hasErrors,
  isoDate,
  sendData,
  sendError,
  sendValidationErrors,
  valueOrCurrent,
} from './json.js';

export default async function projectsApi(app) {
  app.get('/projects', async (_request, reply) => {
    return sendData(reply, getProjects().map(formatProject));
  });

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
      isRegular: run.isRegular,
    }));

    return sendData(reply, {
      project: formatProject(project),
      scenarios: activeScenarios.map(formatScenarioItem),
      upcoming,
      lastFullReport,
      lastPartialReport,
      recentReports: data.recentReports.map(formatReport),
    });
  });

  app.post('/projects', async (request, reply) => {
    const { project, errors } = cleanProject(request.body || {});
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    const projectId = createProjectWithScenario(project);
    reply.code(201);
    return sendData(reply, formatProject(findProjectById(projectId)));
  });

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

  app.delete('/projects/:id', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return sendError(reply, 404, 'not_found', 'Проект не найден');

    const running = getProjectReports(project.id).some((report) => report.status === 'running');
    if (running) {
      return sendError(reply, 409, 'conflict', 'Сейчас идёт проверка этого проекта: отмените её или дождитесь конца');
    }

    deleteProjectWithFiles(project);
    return sendData(reply, { deleted: true });
  });

  app.post('/projects/:id/logo', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return sendError(reply, 404, 'not_found', 'Проект не найден');

    const saved = await saveProjectLogo(project, request);
    if (!saved) {
      return sendValidationErrors(reply, {
        logo: 'Нужна картинка PNG, JPEG или WebP не больше 2 МБ, отправленная как multipart/form-data',
      });
    }
    return sendData(reply, formatProject(findProjectById(project.id)));
  });
}
