// Настройки сервиса. Меняются переменными окружения (или файлом .env).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PORT = Number(process.env.PORT) || 3001;
export const HOST = process.env.HOST || '127.0.0.1';

// Папка с данными: база и скриншоты отчётов
export const DATA_DIR = process.env.DATA_DIR || fileURLToPath(new URL('../data', import.meta.url));
export const DB_PATH = join(DATA_DIR, 'app.db');
export const MEDIA_DIR = join(DATA_DIR, 'media');

// Создаём папки, если их ещё нет
mkdirSync(MEDIA_DIR, { recursive: true });
