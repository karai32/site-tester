// Сценарии: список проекта с фильтрами, один сценарий, его отчёты
import { findProjectById } from '../db/projects.js';
import { getScenarioReports } from '../db/reports.js';
import { findScenarioById } from '../db/scenarios.js';
import { listScenarios } from '../scenario-list.js';
import { formatReport, formatScenario, formatScenarioItem } from './format.js';
import { listFilters, pageOf } from './lists.js';
import { sendData, sendError } from './response.js';

// Сценарий с цифрами для списка (категории, тесты, страницы) или undefined
function findScenarioItem(id) {
  const scenario = findScenarioById(id);
  if (!scenario) return undefined;

  // Ищем сценарий среди активных и неактивных его проекта — там уже посчитаны цифры
  const noFilters = { author: '', categories: [], regular: '', sort: 'new' };
  const active = listScenarios(scenario.project_id, { ...noFilters, inactive: false }).scenarios;
  const inactive = listScenarios(scenario.project_id, { ...noFilters, inactive: true }).scenarios;
  return [...active, ...inactive].find((item) => item.id === scenario.id);
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

  // Отчёты сценария от самого недавнего до самого первого — для «Сводки по сценарию»
  app.get('/scenarios/:id/reports', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario) return sendError(reply, 404, 'not_found', 'Сценарий не найден');

    const { items, meta } = pageOf(getScenarioReports(scenario.id), request.query);
    return sendData(reply, items.map(formatReport), meta);
  });
}
