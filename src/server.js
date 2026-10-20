// Точка входа: создаёт сервер, подключает плагины и маршруты.
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

// Cookie (для сессий) и данные из обычных HTML-форм
await app.register(fastifyCookie);
await app.register(fastifyFormbody);

// Загрузка файлов из форм (аватарка проекта): один файл, не больше 2 МБ
await app.register(fastifyMultipart, { limits: { files: 1, fileSize: 2 * 1024 * 1024 } });

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

// UI-кит интерфейса (папка ui-kit): /ui.html. Открывается только после входа.
await app.register(fastifyStatic, {
  root: fileURLToPath(new URL('../ui-kit', import.meta.url)),
  prefix: '/ui-kit/',
  decorateReply: false,
});
app.get('/ui.html', async (_request, reply) => reply.redirect('/ui-kit/ui.html'));

// Шаблоны EJS из src/views. В любом шаблоне доступны функции из helpers.js,
// варианты расписания и настройки уведомлений.
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

// Страницы, которые открываются без входа
const PUBLIC_PATHS = ['/login', '/health'];

// Перед каждым запросом: узнаём, кто вошёл. Без входа отправляем на /login.
// API проверяет вход сам - по ключу (src/api/index.js).
app.addHook('preHandler', async (request, reply) => {
  const path = request.url.split('?')[0];
  if (path.startsWith('/assets/') || path.startsWith('/api/')) return;

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

await app.register(api, { prefix: '/api' });
await app.register(authRoutes);
await app.register(projectRoutes);
await app.register(scenarioRoutes);
await app.register(reportRoutes);
await app.register(profileRoutes);
await app.register(settingsRoutes);

app.get('/', async (_request, reply) => reply.redirect('/projects'));

// Проверка, что сервер жив. Деплой смотрит checkRunning, чтобы не перезапускать сервер посреди проверки.
app.get('/health', async () => ({ status: 'ok', checkRunning: isCheckRunning() }));

app.setNotFoundHandler(async (_request, reply) => {
  return reply.code(404).view('not-found.ejs', { title: 'Страница не найдена' }, { layout: 'layouts/app.ejs' });
});

await app.listen({ port: PORT, host: HOST });

// Очередь проверок: запускает отчёты со статусом queued по одному
startQueue(app.log);

// Telegram-бот отвечает пользователям их Telegram ID (если задан TELEGRAM_BOT_TOKEN)
startTelegramBot(app.log);

// Остановка сервера (systemctl stop, Ctrl+C): выходим сразу, браузер закроет Playwright.
// Без этого Playwright перехватывает сигнал, и сервер продолжает работать.
// Идущая проверка будет отмечена прерванной при следующем запуске.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => process.exit(0));
}
