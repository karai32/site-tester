// JSON API для сторонней админки: всё по адресам /api/...
// Каждый запрос — с ключом в заголовке «Authorization: Bearer 808ck_...», ключи создаются
// в «Настройках». Запрос выполняется от имени того, кто создал ключ (request.apiUser).
// Cookie входа здесь не действуют: только ключ.
import { findApiUser } from '../auth/api-keys.js';
import catalogApi from './catalog.js';
import projectsApi from './projects.js';
import reportsApi from './reports.js';
import { sendError } from './response.js';
import scenariosApi from './scenarios.js';

export default async function api(app) {
  // Ключ: нет или неверный — 401
  app.decorateRequest('apiUser', null);
  app.addHook('onRequest', async (request, reply) => {
    const user = findApiUser(request);
    if (!user) {
      return sendError(reply, 401, 'unauthorized', 'Нужен действующий API-ключ: заголовок Authorization: Bearer <ключ>');
    }
    request.apiUser = user;
  });

  // Любая ошибка — в формате API. Подробности внутренних ошибок наружу не отдаём, они в логе.
  app.setErrorHandler((error, request, reply) => {
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return sendError(reply, error.statusCode, 'bad_request', error.message); // например, неверный JSON
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
}
