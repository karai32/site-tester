// Настройки сервиса: API-ключи вошедшего пользователя и справка по API
import { readFileSync } from 'node:fs';
import { generateApiKey } from '../auth/api-keys.js';
import { APP_URL } from '../config.js';
import { createApiKey, deleteApiKey, getUserApiKeys } from '../db/api-keys.js';

// Примеры запросов и ответов для справки. Снимаются с тестового сервера: scripts/api-examples.js
const apiExamples = JSON.parse(readFileSync(new URL('../api/examples.json', import.meta.url), 'utf8'));

// Примеры по разделам: [{ title, examples }] в том порядке, в каком они в файле
function examplesBySection() {
  const sections = [];
  for (const example of apiExamples) {
    let section = sections.find((item) => item.title === example.section);
    if (!section) {
      section = { title: example.section, examples: [] };
      sections.push(section);
    }
    section.examples.push(example);
  }
  return sections;
}

// options: newKey - только что созданный ключ (показывается один раз), error - ошибка формы
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
    if (!name) return showSettings(reply, { error: 'Укажите название ключа' });

    const { key, keyHash, keyStart } = generateApiKey();
    createApiKey({ userId: reply.locals.user.id, name, keyHash, keyStart });
    return showSettings(reply, { newKey: { name, key } });
  });

  // Справка по API: как подключиться и примеры всех запросов
  app.get('/settings/api', async (_request, reply) => {
    return reply.view('api-docs.ejs', {
      title: 'Справка по API',
      apiUrl: `${APP_URL}/api`,
      sections: examplesBySection(),
    }, { layout: 'layouts/app.ejs' });
  });

  // Удалить ключ: запросы с ним сразу перестают работать
  app.post('/settings/api-keys/:keyId/delete', async (request, reply) => {
    deleteApiKey(Number(request.params.keyId), reply.locals.user.id);
    return reply.redirect('/settings');
  });
}
