// JSON API для сторонней админки: всё по адресам /api/v1/...
// Каждый запрос — с ключом в заголовке «Authorization: Bearer 808ck_...», ключи создаются
// в «Настройках». Запрос выполняется от имени того, кто создал ключ (request.apiUser).
// Cookie входа здесь не действуют: только ключ.
import rateLimit from '@fastify/rate-limit';
import { findApiUser } from '../auth/api-keys.js';
import catalogApi from './catalog.js';
import { sendError } from './response.js';

const REQUESTS_PER_MINUTE = 120; // на один ключ (без ключа — на один IP)

export default async function api(app) {
  // Не больше REQUESTS_PER_MINUTE запросов в минуту — защита от перебора ключей и случайных циклов
  await app.register(rateLimit, {
    max: REQUESTS_PER_MINUTE,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.headers.authorization || request.ip,
    errorResponseBuilder: () => ({ statusCode: 429, message: 'too many requests' }),
  });

  // Ключ: нет или неверный — 401. Проверяем на шаге preHandler, то есть после счётчика
  // запросов (он срабатывает раньше, на onRequest): так перебор ключей тоже упирается в лимит.
  app.decorateRequest('apiUser', null);
  app.addHook('preHandler', async (request, reply) => {
    const user = findApiUser(request);
    if (!user) {
      return sendError(reply, 401, 'unauthorized', 'Нужен действующий API-ключ: заголовок Authorization: Bearer <ключ>');
    }
    request.apiUser = user;
  });

  // Любая ошибка — в формате API. Подробности внутренних ошибок наружу не отдаём, они в логе.
  app.setErrorHandler((error, request, reply) => {
    if (error.statusCode === 429) {
      return sendError(reply, 429, 'too_many_requests', `Не больше ${REQUESTS_PER_MINUTE} запросов в минуту`);
    }
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
}
