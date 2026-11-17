import { findProjectById } from '../db/projects.js';
import { createReport, findReportById, getScenarioReports } from '../db/reports.js';
import {
  cancelDeferredCheck,
  findScenarioById,
  setScenarioNotifications,
  setScenarioSchedule,
} from '../db/scenarios.js';
import { cleanNotifications } from '../logic/notifications.js';
import {
  cleanScenario,
  listScenarios,
  planDeferredCheck,
  revisionName,
  saveScenario,
  scenarioItems,
  scenarioPageSetIds,
  scenarioTestIds,
  setActive,
} from '../logic/scenarios.js';
import { cleanSchedule, firstRunText, scenarioSchedule } from '../logic/schedule.js';
import {
  formatReport,
  formatScenario,
  formatScenarioItem,
  hasErrors,
  listFilters,
  pageOf,
  sendData,
  sendError,
  sendValidationErrors,
  valueOrCurrent,
} from './json.js';

function findScenarioItem(id) {
  const scenario = findScenarioById(id);
  if (!scenario) return undefined;
  return scenarioItems(scenario.project_id).find((item) => item.id === scenario.id);
}

function sendScenario(reply, scenarioId) {
  return sendData(reply, formatScenario(findScenarioItem(scenarioId)));
}

export default async function scenariosApi(app) {
  app.get('/projects/:id/scenarios', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return sendError(reply, 404, 'not_found', 'Проект не найден');

    const filters = { ...listFilters(request.query), inactive: request.query.status === 'inactive' };
    const result = listScenarios(project.id, filters);
    const { items, meta } = pageOf(result.scenarios, request.query);

    return sendData(reply, items.map(formatScenarioItem), {
      ...meta,
      activeCount: result.activeCount,
      inactiveCount: result.inactiveCount,
      authors: result.authors,
    });
  });

  app.get('/scenarios/:id', async (request, reply) => {
    const item = findScenarioItem(request.params.id);
    if (!item) return sendError(reply, 404, 'not_found', 'Сценарий не найден');
    return sendData(reply, formatScenario(item));
  });

  app.get('/scenarios/:id/reports', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');

    const { items, meta } = pageOf(getScenarioReports(scenario.id), request.query);
    return sendData(reply, items.map(formatReport), meta);
  });

  app.post('/projects/:id/scenarios', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return sendError(reply, 404, 'not_found', 'Проект не найден');

    const { scenario, errors } = cleanScenario(request.body || {}, project.id);
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    const scenarioId = saveScenario({ projectId: project.id, authorId: request.apiUser.id, scenario });
    reply.code(201);
    return sendScenario(reply, scenarioId);
  });

  app.post('/scenarios/:id/copy', async (request, reply) => {
    const source = findScenarioById(request.params.id);
    if (!source) return sendError(reply, 404, 'not_found', 'Сценарий не найден');

    const body = request.body || {};
    const { scenario, errors } = cleanScenario({
      name: valueOrCurrent(body, 'name', revisionName(source)),
      testIds: valueOrCurrent(body, 'testIds', scenarioTestIds(source)),
      pageSets: valueOrCurrent(body, 'pageSets', scenarioPageSetIds(source)),
      schedule: valueOrCurrent(body, 'schedule', scenarioSchedule(source)),
      notifications: valueOrCurrent(body, 'notifications', source.notifications),
    }, source.project_id);
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    const scenarioId = saveScenario({ projectId: source.project_id, authorId: request.apiUser.id, scenario, source });
    reply.code(201);
    return sendScenario(reply, scenarioId);
  });

  app.put('/scenarios/:id/active', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');

    const isActive = (request.body || {}).isActive;
    if (typeof isActive !== 'boolean') return sendValidationErrors(reply, { isActive: 'Укажите isActive: true или false' });

    setActive(scenario, isActive);
    return sendScenario(reply, scenario.id);
  });

  app.put('/scenarios/:id/schedule', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');

    const { schedule, errors } = cleanSchedule(request.body || {});
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    setScenarioSchedule(scenario.id, schedule, firstRunText(schedule));
    return sendScenario(reply, scenario.id);
  });

  app.put('/scenarios/:id/notifications', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');

    const { notifications, errors } = cleanNotifications(request.body || {});
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    setScenarioNotifications(scenario.id, notifications);
    return sendScenario(reply, scenario.id);
  });

  app.put('/scenarios/:id/deferred', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');
    if (!scenario.is_active) return sendError(reply, 409, 'conflict', 'Сценарий выключен');

    let runAt = new Date(String((request.body || {}).runAt || ''));
    if (Number.isNaN(runAt.getTime())) runAt = null;

    const error = planDeferredCheck(scenario, runAt, request.apiUser.id);
    if (error) return sendValidationErrors(reply, { runAt: error });
    return sendScenario(reply, scenario.id);
  });

  app.delete('/scenarios/:id/deferred', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');

    cancelDeferredCheck(scenario.id);
    return sendScenario(reply, scenario.id);
  });

  app.post('/scenarios/:id/checks', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');
    if (!scenario.is_active) return sendError(reply, 409, 'conflict', 'Сценарий выключен');

    const reportId = createReport({
      projectId: scenario.project_id,
      scenarioId: scenario.id,
      startedBy: request.apiUser.id,
    });
    reply.code(201);
    return sendData(reply, formatReport(findReportById(reportId)));
  });
}
