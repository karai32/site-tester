import { readFileSync } from 'node:fs';
import { APP_URL } from '../config.js';
import { createApiKey, deleteApiKey, getUserApiKeys, updateUser } from '../db/users.js';
import { cleanUser, generateApiKey } from '../logic/users.js';

const apiExamples = JSON.parse(readFileSync(new URL('../api/examples.json', import.meta.url), 'utf8'));

const SECTION_ORDER = ['Сценарии', 'Проверки и отчёты', 'Проекты', 'Пользователи', 'Справочники', 'Ошибки'];

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
  sections.sort((a, b) => SECTION_ORDER.indexOf(a.title) - SECTION_ORDER.indexOf(b.title));
  return sections;
}

function showProfile(reply, options) {
  if (options.errors.length > 0) reply.code(400);
  return reply.view('profile.ejs', { title: 'Профиль', ...options }, { layout: 'layouts/app.ejs' });
}

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

export default async function accountPages(app) {
  app.get('/profile', async (request, reply) => {
    const user = reply.locals.user;
    const contacts = { email: user.email || '', telegramId: user.telegram_id || '' };
    return showProfile(reply, { contacts, errors: [], saved: request.query.saved === '1' });
  });

  app.post('/profile', async (request, reply) => {
    const body = request.body || {};
    const { user, errors } = cleanUser({
      name: reply.locals.user.name,
      email: body.email,
      telegramId: body.telegram_id,
    }, false);
    if (Object.keys(errors).length > 0) {
      return showProfile(reply, { contacts: user, errors: Object.values(errors), saved: false });
    }

    updateUser(reply.locals.user.id, user);
    return reply.redirect('/profile?saved=1');
  });

  app.get('/settings', async (_request, reply) => {
    return showSettings(reply, {});
  });

  app.post('/settings/api-keys', async (request, reply) => {
    const name = String((request.body && request.body.name) || '').trim();
    if (!name) return showSettings(reply, { error: 'Укажите название ключа' });

    const { key, keyHash, keyStart } = generateApiKey();
    createApiKey({ userId: reply.locals.user.id, name, keyHash, keyStart });
    return showSettings(reply, { newKey: { name, key } });
  });

  app.get('/settings/api', async (_request, reply) => {
    return reply.view('api-docs.ejs', {
      title: 'Справка по API',
      apiUrl: `${APP_URL}/api`,
      sections: examplesBySection(),
    }, { layout: 'layouts/app.ejs' });
  });

  app.post('/settings/api-keys/:keyId/delete', async (request, reply) => {
    deleteApiKey(Number(request.params.keyId), reply.locals.user.id);
    return reply.redirect('/settings');
  });
}
