// Сценарии: список проекта с фильтрами, один сценарий, его отчёты, создание, новая редакция,
// включение и выключение, регулярность, уведомления, отложенная проверка, запуск проверки
import { findProjectById } from '../db/projects.js';
import { createReport, findReportWithNames, getScenarioReports } from '../db/reports.js';
import {
  cancelDeferredCheck,
  findScenarioById,
  setScenarioNotifications,
  setScenarioSchedule,
} from '../db/scenarios.js';
import { cleanNotifications } from '../notifications/settings.js';
import { cleanSchedule, firstRunText, scenarioSchedule } from '../schedule.js';
import { cleanScenario, planDeferredCheck, revisionName, saveScenario, setActive } from '../scenario-actions.js';
import { scenarioPageSetIds, scenarioTestIds } from '../scenario-info.js';
import { listScenarios } from '../scenario-list.js';
import { formatReport, formatScenario, formatScenarioItem } from './format.js';
import { listFilters, pageOf } from './lists.js';
import { hasErrors, sendData, sendError, sendValidationErrors, valueOrCurrent } from './response.js';

// Сценарий с цифрами для списка (категории, тесты, страницы) или undefined
function findScenarioItem(id) {
  const scenario = findScenarioById(id);
  if (!scenario) return undefined;

  // Ищем сценарий среди активных и неактивных его проекта - там уже посчитаны цифры
  const noFilters = { author: '', categories: [], regular: '', sort: 'new' };
  const active = listScenarios(scenario.project_id, { ...noFilters, inactive: false }).scenarios;
  const inactive = listScenarios(scenario.project_id, { ...noFilters, inactive: true }).scenarios;
  return [...active, ...inactive].find((item) => item.id === scenario.id);
}

// Ответ «сценарий целиком» по id
function sendScenario(reply, scenarioId) {
  return sendData(reply, formatScenario(findScenarioItem(scenarioId)));
}

export default async function scenariosApi(app) {
  // Сценарии проекта, как на странице «Сценарии»:
  // ?status=inactive&author=...&categories=seo,forms&regular=yes&sort=tests-desc&page=1&perPage=10
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
      authors: result.authors, // значения для фильтра author
    });
  });

  // Сценарий целиком: тесты по категориям, выборки, регулярность, уведомления
  app.get('/scenarios/:id', async (request, reply) => {
    const item = findScenarioItem(request.params.id);
    if (!item) return sendError(reply, 404, 'not_found', 'Сценарий не найден');
    return sendData(reply, formatScenario(item));
  });

  // Отчёты сценария от самого недавнего до самого первого - для «Сводки по сценарию»
  app.get('/scenarios/:id/reports', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');

    const { items, meta } = pageOf(getScenarioReports(scenario.id), request.query);
    return sendData(reply, items.map(formatReport), meta);
  });

  // Новый сценарий: { name, testIds, pageSets, schedule?, notifications? } - см. справку по API
  app.post('/projects/:id/scenarios', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return sendError(reply, 404, 'not_found', 'Проект не найден');

    const { scenario, errors } = cleanScenario(request.body || {});
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    const scenarioId = saveScenario({ projectId: project.id, authorId: request.apiUser.id, scenario });
    reply.code(201);
    return sendScenario(reply, scenarioId);
  });

  // «Скопировать и изменить»: новая редакция сценария, исходный не меняется.
  // Те же поля, что при создании; непереданные берутся из исходного, название - «... #N».
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
    });
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    const scenarioId = saveScenario({ projectId: source.project_id, authorId: request.apiUser.id, scenario, source });
    reply.code(201);
    return sendScenario(reply, scenarioId);
  });

  // Включить или выключить: { isActive: true | false }
  app.put('/scenarios/:id/active', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');

    const isActive = (request.body || {}).isActive;
    if (typeof isActive !== 'boolean') return sendValidationErrors(reply, { isActive: 'Укажите isActive: true или false' });

    setActive(scenario, isActive);
    return sendScenario(reply, scenario.id);
  });

  // Регулярность: { type, time, number }, type = null - нерегулярный
  app.put('/scenarios/:id/schedule', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');

    const { schedule, errors } = cleanSchedule(request.body || {});
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    setScenarioSchedule(scenario.id, schedule, firstRunText(schedule));
    return sendScenario(reply, scenario.id);
  });

  // Уведомления: { events, passPercent, emails, telegramIds }
  app.put('/scenarios/:id/notifications', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');

    const { notifications, errors } = cleanNotifications(request.body || {});
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    setScenarioNotifications(scenario.id, notifications);
    return sendScenario(reply, scenario.id);
  });

  // Отложенная проверка: { runAt: '2026-10-20T06:00:00Z' } - один запуск в это время
  app.put('/scenarios/:id/deferred', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');
    if (!scenario.is_active) return sendError(reply, 409, 'conflict', 'Сценарий выключен');

    let runAt = new Date(String((request.body || {}).runAt || ''));
    if (Number.isNaN(runAt.getTime())) runAt = null; // не дата

    const error = planDeferredCheck(scenario, runAt, request.apiUser.id);
    if (error) return sendValidationErrors(reply, { runAt: error });
    return sendScenario(reply, scenario.id);
  });

  // Отменить отложенную проверку
  app.delete('/scenarios/:id/deferred', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');

    cancelDeferredCheck(scenario.id);
    return sendScenario(reply, scenario.id);
  });

  // Запустить проверку сейчас: она встаёт в очередь, ответ - новый отчёт со статусом queued
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
    return sendData(reply, formatReport(findReportWithNames(reportId)));
  });
}
