import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyFormbody from '@fastify/formbody';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import ejs from 'ejs';

import api from './api/index.js';
import { startTelegramBot } from './checks/notify.js';
import { startQueue } from './checks/queue.js';
import { HOST, MEDIA_DIR, PORT, TELEGRAM_BOT_NAME } from './config.js';
import { getProjects } from './db/projects.js';
import { isCheckRunning } from './db/reports.js';
import * as format from './logic/format.js';
import { CHANNELS, enabledEvents, NOTIFICATION_EVENTS, notificationsText } from './logic/notifications.js';
import { DEFAULT_TIME, SCHEDULE_TYPES, scheduleText } from './logic/schedule.js';
import { getCurrentUser } from './logic/users.js';
import accountPages from './pages/account.js';
import loginPages from './pages/login.js';
import projectPages from './pages/projects.js';
import reportPages from './pages/reports.js';
import scenarioPages from './pages/scenarios.js';

const app = Fastify({ logger: true });

await app.register(fastifyCookie);
await app.register(fastifyFormbody);

await app.register(fastifyMultipart, { limits: { files: 1, fileSize: 2 * 1024 * 1024 } });

await app.register(fastifyStatic, {
  root: fileURLToPath(new URL('../public/assets', import.meta.url)),
  prefix: '/assets/',
});

await app.register(fastifyStatic, {
  root: MEDIA_DIR,
  prefix: '/media/',
  decorateReply: false,
});

await app.register(fastifyView, {
  engine: { ejs },
  root: fileURLToPath(new URL('./views', import.meta.url)),
  defaultContext: {
    ...format,
    DEFAULT_TIME,
    SCHEDULE_TYPES,
    scheduleText,
    NOTIFICATION_EVENTS,
    CHANNELS,
    enabledEvents,
    notificationsText,
    TELEGRAM_BOT_NAME,
  },
});

const PUBLIC_PATHS = ['/login', '/health'];

app.addHook('preHandler', async (request, reply) => {
  const path = request.url.split('?')[0];
  if (path.startsWith('/assets/') || path.startsWith('/api/')) return;

  const user = getCurrentUser(request);

  reply.locals = {
    user,
    currentPath: path,
    sidebarProjects: user ? getProjects() : [],
  };

  if (!user && !PUBLIC_PATHS.includes(path)) {
    return reply.redirect('/login');
  }
});

await app.register(api, { prefix: '/api' });
await app.register(loginPages);
await app.register(projectPages);
await app.register(scenarioPages);
await app.register(reportPages);
await app.register(accountPages);

app.get('/', async (_request, reply) => reply.redirect('/projects'));

app.get('/health', async () => ({ status: 'ok', checkRunning: isCheckRunning() }));

app.setNotFoundHandler(async (_request, reply) => {
  return reply.code(404).view('not-found.ejs', { title: 'Страница не найдена' }, { layout: 'layouts/app.ejs' });
});

await app.listen({ port: PORT, host: HOST });

startQueue(app.log);

startTelegramBot(app.log);

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => process.exit(0));
}
