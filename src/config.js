// Настройки сервиса. Меняются переменными окружения, например: PORT=3005 npm run dev
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PORT = Number(process.env.PORT) || 3001;
export const HOST = process.env.HOST || '127.0.0.1';

// Папка с данными: база и скриншоты отчётов
export const DATA_DIR = process.env.DATA_DIR || fileURLToPath(new URL('../data', import.meta.url));
export const DB_PATH = join(DATA_DIR, 'app.db');
export const MEDIA_DIR = join(DATA_DIR, 'media');

// Адрес сервиса - для ссылок на отчёты в уведомлениях
export const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// Уведомления. Токены и пароли не хранятся в git: на сервере они лежат в /etc/808-checker.secrets.env.
// Не заданы - уведомления этим способом не отправляются (в лог пишется, что не настроено).
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const TELEGRAM_BOT_NAME = process.env.TELEGRAM_BOT_NAME || ''; // имя бота без @, для подсказок
export const SMTP_HOST = process.env.SMTP_HOST || '';
export const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
export const SMTP_USER = process.env.SMTP_USER || '';
export const SMTP_PASS = process.env.SMTP_PASS || '';
export const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER; // от кого письма: «808 Checker <checker@808.ru>»

// Создаём папки, если их ещё нет
mkdirSync(MEDIA_DIR, { recursive: true });
