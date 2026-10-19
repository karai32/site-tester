// Настройки сервиса: API-ключи вошедшего пользователя
import { generateApiKey } from '../auth/api-keys.js';
import { createApiKey, deleteApiKey, getUserApiKeys } from '../db/api-keys.js';

// options: newKey — только что созданный ключ (показывается один раз), error — ошибка формы
function showSettings(reply, options) {
  if (options.error) reply.code(400);
  return reply.view('settings.ejs', {
    title: 'Настройки',
    apiKeys: getUserApiKeys(reply.locals.user.id),
    newKey: null,
    error: '',
    ...options,
  }, { layout: 'layouts/app.ejs' });
}

export default async function settingsRoutes(app) {
  app.get('/settings', async (_request, reply) => {
    return showSettings(reply, {});
  });

  // Новый ключ. Показываем его сразу на странице, без перехода: больше он нигде не появится.
  app.post('/settings/api-keys', async (request, reply) => {
    const name = String((request.body && request.body.name) || '').trim();
    if (!name) return showSettings(reply, { error: 'Укажите, для чего ключ, например «Админка 808»' });

    const { key, keyHash, keyStart } = generateApiKey();
    createApiKey({ userId: reply.locals.user.id, name, keyHash, keyStart });
    return showSettings(reply, { newKey: { name, key } });
  });

  // Удалить ключ: запросы с ним сразу перестают работать
  app.post('/settings/api-keys/:keyId/delete', async (request, reply) => {
    deleteApiKey(Number(request.params.keyId), reply.locals.user.id);
    return reply.redirect('/settings');
  });
}
