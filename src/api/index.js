import { CHANNELS, NOTIFICATION_EVENTS } from '../logic/notifications.js';
import { PAGE_SETS } from '../logic/page-sets.js';
import { SCHEDULE_TYPES } from '../logic/schedule.js';
import { findApiUser } from '../logic/users.js';
import { allCategories } from '../tests/index.js';
import { formatUser, sendData, sendError } from './json.js';
import projectsApi from './projects.js';
import reportsApi from './reports.js';
import scenariosApi from './scenarios.js';
import usersApi from './users.js';

async function catalogApi(app) {
  app.get('/me', async (request, reply) => {
    return sendData(reply, formatUser(request.apiUser));
  });

  app.get('/catalog', async (_request, reply) => {
    const categoryList = [];
    for (const category of allCategories()) {
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

    return sendData(reply, {
      categories: categoryList,
      pageSets: PAGE_SETS.map((set) => ({ id: set.id, title: set.title })),
      scheduleTypes,
      notificationEvents: NOTIFICATION_EVENTS,
      notificationChannels: CHANNELS,
    });
  });
}

export default async function api(app) {
  app.decorateRequest('apiUser', null);
  app.addHook('onRequest', async (request, reply) => {
    const user = findApiUser(request);
    if (!user) {
      return sendError(reply, 401, 'unauthorized', 'Нужен действующий API-ключ: заголовок Authorization: Bearer <ключ>');
    }
    request.apiUser = user;
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
  await app.register(projectsApi);
  await app.register(scenariosApi);
  await app.register(reportsApi);
  await app.register(usersApi);
}
