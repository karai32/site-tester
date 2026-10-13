// Точка входа: создаёт сервер, подключает плагины и маршруты.
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyFormbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import ejs from 'ejs';

import { getCurrentUser } from './auth/session.js';
import { HOST, MEDIA_DIR, PORT } from './config.js';
import { getProjects } from './db/projects.js';
import * as helpers from './helpers.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import profileRoutes from './routes/profile.js';
import settingsRoutes from './routes/settings.js';
import { startQueue } from './runner/queue.js';

const app = Fastify({ logger: true });

// Cookie (для сессий) и данные из обычных HTML-форм
await app.register(fastifyCookie);
await app.register(fastifyFormbody);

// CSS, JS и картинки: файл public/assets/css/style.css открывается по адресу /assets/css/style.css
await app.register(fastifyStatic, {
  root: fileURLToPath(new URL('../public/assets', import.meta.url)),
  prefix: '/assets/',
});

// Скриншоты отчётов из папки data/media. Открываются только после входа.
await app.register(fastifyStatic, {
  root: MEDIA_DIR,
  prefix: '/media/',
  decorateReply: false,
});

// Шаблоны EJS из src/views. Функции из helpers.js доступны в любом шаблоне.
await app.register(fastifyView, {
  engine: { ejs },
  root: fileURLToPath(new URL('./views', import.meta.url)),
  defaultContext: helpers,
});

// Страницы, которые открываются без входа
const PUBLIC_PATHS = ['/login'];

// Перед каждым запросом: узнаём, кто вошёл. Без входа отправляем на /login.
app.addHook('preHandler', async (request, reply) => {
  const path = request.url.split('?')[0];
  if (path.startsWith('/assets/')) return;

  const user = getCurrentUser(request);

  // reply.locals попадают во все шаблоны
  reply.locals = {
    user,
    currentPath: path,
    sidebarProjects: user ? getProjects() : [],
  };

  if (!user && !PUBLIC_PATHS.includes(path)) {
    return reply.redirect('/login');
  }
});

await app.register(authRoutes);
await app.register(projectRoutes);
await app.register(profileRoutes);
await app.register(settingsRoutes);

app.get('/', async (_request, reply) => reply.redirect('/projects'));

app.setNotFoundHandler(async (_request, reply) => {
  return reply.code(404).view('not-found.ejs', { title: 'Страница не найдена' }, { layout: 'layouts/app.ejs' });
});

await app.listen({ port: PORT, host: HOST });

// Очередь проверок: запускает отчёты со статусом queued по одному
startQueue(app.log);

// Остановка сервера (systemctl stop, Ctrl+C): выходим сразу, браузер закроет Playwright.
// Без этого Playwright перехватывает сигнал, и сервер продолжает работать.
// Идущая проверка будет отмечена прерванной при следующем запуске.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => process.exit(0));
}
