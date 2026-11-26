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

function sendScenario(request, reply, scenarioId) {
  const item = scenarioItems(request.project.id).find((scenario) => scenario.id === Number(scenarioId));
  return sendData(reply, formatScenario(item));
}

export default async function scenariosApi(app) {
  app.get('/scenarios', async (request, reply) => {
    const filters = { ...listFilters(request.query), inactive: request.query.status === 'inactive' };
    const result = listScenarios(request.project.id, filters);
    const { items, meta } = pageOf(result.scenarios, request.query);

    return sendData(reply, items.map(formatScenarioItem), {
      ...meta,
      activeCount: result.activeCount,
      inactiveCount: result.inactiveCount,
    });
  });

  app.post('/scenarios', async (request, reply) => {
    const projectId = request.project.id;
    const { scenario, errors } = cleanScenario(request.body || {}, projectId);
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    reply.code(201);
    return sendScenario(request, reply, saveScenario({ projectId, scenario }));
  });

  app.get('/scenarios/:id', async (request, reply) => {
    return sendScenario(request, reply, request.params.id);
  });

  app.get('/scenarios/:id/reports', async (request, reply) => {
    const { items, meta } = pageOf(getScenarioReports(request.params.id), request.query);
    return sendData(reply, items.map(formatReport), meta);
  });

  app.post('/scenarios/:id/copy', async (request, reply) => {
    const source = findScenarioById(request.params.id);

    const body = request.body || {};
    const { scenario, errors } = cleanScenario({
      name: valueOrCurrent(body, 'name', revisionName(source)),
      testIds: valueOrCurrent(body, 'testIds', scenarioTestIds(source)),
      pageSets: valueOrCurrent(body, 'pageSets', scenarioPageSetIds(source)),
      schedule: valueOrCurrent(body, 'schedule', scenarioSchedule(source)),
      notifications: valueOrCurrent(body, 'notifications', source.notifications),
    }, source.project_id);
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    reply.code(201);
    return sendScenario(request, reply, saveScenario({ projectId: source.project_id, scenario, source }));
  });

  app.put('/scenarios/:id/active', async (request, reply) => {
    const isActive = (request.body || {}).isActive;
    if (typeof isActive !== 'boolean') return sendValidationErrors(reply, { isActive: 'Укажите isActive: true или false' });

    setActive(findScenarioById(request.params.id), isActive);
    return sendScenario(request, reply, request.params.id);
  });

  app.put('/scenarios/:id/schedule', async (request, reply) => {
    const { schedule, errors } = cleanSchedule(request.body || {});
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    setScenarioSchedule(request.params.id, schedule, firstRunText(schedule));
    return sendScenario(request, reply, request.params.id);
  });

  app.put('/scenarios/:id/notifications', async (request, reply) => {
    const { notifications, errors } = cleanNotifications(request.body || {});
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    setScenarioNotifications(request.params.id, notifications);
    return sendScenario(request, reply, request.params.id);
  });

  app.put('/scenarios/:id/deferred', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario.is_active) return sendError(reply, 409, 'conflict', 'Сценарий выключен');

    let runAt = new Date(String((request.body || {}).runAt || ''));
    if (Number.isNaN(runAt.getTime())) runAt = null;

    const error = planDeferredCheck(scenario, runAt);
    if (error) return sendValidationErrors(reply, { runAt: error });
    return sendScenario(request, reply, scenario.id);
  });

  app.delete('/scenarios/:id/deferred', async (request, reply) => {
    cancelDeferredCheck(request.params.id);
    return sendScenario(request, reply, request.params.id);
  });

  app.post('/scenarios/:id/checks', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario.is_active) return sendError(reply, 409, 'conflict', 'Сценарий выключен');

    const reportId = createReport({ projectId: scenario.project_id, scenarioId: scenario.id });
    reply.code(201);
    return sendData(reply, formatReport(findReportById(reportId)));
  });
}
