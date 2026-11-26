import { findProjectById, updateProject } from '../db/projects.js';
import { cleanProject, dashboardData, saveProjectLogo } from '../logic/projects.js';
import { listScenarios } from '../logic/scenarios.js';
import {
  formatProject,
  formatReport,
  formatScenarioItem,
  hasErrors,
  isoDate,
  sendData,
  sendValidationErrors,
  valueOrCurrent,
} from './json.js';

export default async function projectApi(app) {
  app.get('/project', async (request, reply) => {
    const project = request.project;
    const data = dashboardData(project.id);
    const activeScenarios = listScenarios(project.id, { inactive: false, categories: [], regular: '', sort: 'old' }).scenarios;

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

  app.patch('/project', async (request, reply) => {
    const current = request.project;
    const body = request.body || {};
    const { project, errors } = cleanProject({
      name: valueOrCurrent(body, 'name', current.name),
      url: valueOrCurrent(body, 'url', current.url),
    }, false);
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    updateProject(current.id, project);
    return sendData(reply, formatProject(findProjectById(current.id)));
  });

  app.post('/project/logo', async (request, reply) => {
    const saved = await saveProjectLogo(request.project, request);
    if (!saved) {
      return sendValidationErrors(reply, {
        logo: 'Нужна картинка PNG, JPEG или WebP не больше 2 МБ, отправленная как multipart/form-data',
      });
    }
    return sendData(reply, formatProject(findProjectById(request.project.id)));
  });
}
