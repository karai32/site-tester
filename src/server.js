import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyFormbody from '@fastify/formbody';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import ejs from 'ejs';

import api from './api/index.js';
import { getCurrentUser } from './auth/session.js';
import { HOST, MEDIA_DIR, PORT, TELEGRAM_BOT_NAME } from './config.js';
import { getProjects } from './db/projects.js';
import { isCheckRunning } from './db/reports.js';
import * as helpers from './helpers.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import profileRoutes from './routes/profile.js';
import reportRoutes from './routes/reports.js';
import scenarioRoutes from './routes/scenarios.js';
import settingsRoutes from './routes/settings.js';
import { DEFAULT_TIME, SCHEDULE_TYPES, scheduleText } from './schedule.js';
import { CHANNELS, enabledEvents, NOTIFICATION_EVENTS, notificationsText } from './notifications/settings.js';
import { startTelegramBot } from './notifications/telegram.js';
import { startQueue } from './runner/queue.js';

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
    ...helpers,
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
await app.register(authRoutes);
await app.register(projectRoutes);
await app.register(scenarioRoutes);
await app.register(reportRoutes);
await app.register(profileRoutes);
await app.register(settingsRoutes);

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
