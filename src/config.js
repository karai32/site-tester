import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PORT = Number(process.env.PORT) || 3001;
export const HOST = process.env.HOST || '127.0.0.1';

export const DATA_DIR = process.env.DATA_DIR || fileURLToPath(new URL('../data', import.meta.url));
export const DB_PATH = join(DATA_DIR, 'app.db');
export const MEDIA_DIR = join(DATA_DIR, 'media');

export const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

export const PARALLEL_REQUESTS = 8;
export const REQUEST_TIMEOUT_MS = 30_000;
export const PAGE_TIMEOUT_MS = 30_000;
export const TEST_TIMEOUT_MS = 10 * 60 * 1000;

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const TELEGRAM_BOT_NAME = process.env.TELEGRAM_BOT_NAME || '';
export const SMTP_HOST = process.env.SMTP_HOST || '';
export const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
export const SMTP_USER = process.env.SMTP_USER || '';
export const SMTP_PASS = process.env.SMTP_PASS || '';
export const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

mkdirSync(MEDIA_DIR, { recursive: true });
