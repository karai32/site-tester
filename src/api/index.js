import { isOwnRoute, keyProject } from '../logic/auth.js';
import { CHANNELS, NOTIFICATION_EVENTS } from '../logic/notifications.js';
import { PAGE_SETS } from '../logic/page-sets.js';
import { projectCategories } from '../logic/scenarios.js';
import { SCHEDULE_TYPES } from '../logic/schedule.js';
import { sendData, sendError } from './json.js';
import projectApi from './project.js';
import reportsApi from './reports.js';
import scenariosApi from './scenarios.js';

function catalogData(categories) {
  const categoryList = [];
  for (const category of categories) {
    const tests = [];
    for (const test of category.tests) {
      tests.push({ id: test.id, title: test.title });
    }
    categoryList.push({ id: category.id, title: category.title, shortTitle: category.shortTitle, tests });
  }

  const scheduleTypes = [];
  for (const type of SCHEDULE_TYPES) {
    scheduleTypes.push({
      id: type.id,
      title: type.title,
      hint: type.hint || null,
      hasTime: type.hasTime,
      number: type.number || null,
    });
  }

  return {
    categories: categoryList,
    pageSets: PAGE_SETS.map((set) => ({ id: set.id, title: set.title })),
    scheduleTypes,
    notificationEvents: NOTIFICATION_EVENTS,
    notificationChannels: CHANNELS,
  };
}

async function catalogApi(app) {
  app.get('/catalog', async (request, reply) => {
    return sendData(reply, catalogData(projectCategories(request.project.id)));
  });
}

export default async function api(app) {
  app.addHook('onRequest', async (request, reply) => {
    const project = keyProject(request);
    if (!project) {
      return sendError(reply, 401, 'unauthorized', 'Нужен действующий API-ключ: заголовок Authorization: Bearer <ключ>');
    }
    if (!isOwnRoute(request, project.id)) {
      return sendError(reply, 404, 'not_found', 'Не найдено');
    }
    request.project = project;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return sendError(reply, error.statusCode, 'bad_request', error.message);
    }
    request.log.error(error);
    return sendError(reply, 500, 'server_error', 'Внутренняя ошибка сервиса');
  });

  app.setNotFoundHandler((_request, reply) => {
    return sendError(reply, 404, 'not_found', 'Такого адреса в API нет');
  });

  await app.register(catalogApi);
  await app.register(projectApi);
  await app.register(scenariosApi);
  await app.register(reportsApi);
}
