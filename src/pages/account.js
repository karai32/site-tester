import { readFileSync } from 'node:fs';
import { APP_URL } from '../config.js';
import { findProjectById, setProjectContacts } from '../db/projects.js';
import { newApiKey } from '../logic/auth.js';
import { cleanContacts } from '../logic/projects.js';

const apiExamples = JSON.parse(readFileSync(new URL('../api/examples.json', import.meta.url), 'utf8'));

const SECTION_ORDER = ['Сценарии', 'Проверки и отчёты', 'Проект', 'Справочники', 'Ошибки'];

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

export default async function accountPages(app) {
  app.get('/profile', async (request, reply) => {
    const contacts = { email: request.project.email || '', telegramId: request.project.telegram_id || '' };
    return showProfile(reply, { contacts, errors: [], saved: request.query.saved === '1' });
  });

  app.post('/profile', async (request, reply) => {
    const body = request.body || {};
    const { contacts, errors } = cleanContacts({ email: body.email, telegramId: body.telegram_id });
    if (Object.keys(errors).length > 0) {
      return showProfile(reply, { contacts, errors: Object.values(errors), saved: false });
    }

    setProjectContacts(request.project.id, contacts);
    return reply.redirect('/profile?saved=1');
  });

  app.get('/settings', async (_request, reply) => {
    return reply.view('settings.ejs', { title: 'Настройки', newKey: null }, { layout: 'layouts/app.ejs' });
  });

  app.post('/settings/api-key', async (request, reply) => {
    const newKey = newApiKey(request.project.id);
    reply.locals.project = findProjectById(request.project.id);
    return reply.view('settings.ejs', { title: 'Настройки', newKey }, { layout: 'layouts/app.ejs' });
  });

  app.get('/settings/api', async (_request, reply) => {
    return reply.view('api-docs.ejs', {
      title: 'Справка по API',
      apiUrl: `${APP_URL}/api`,
      sections: examplesBySection(),
    }, { layout: 'layouts/app.ejs' });
  });
}
