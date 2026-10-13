// Подключение к базе SQLite. Остальные файлы папки db берут отсюда `db`.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

// Путь к файлу базы можно поменять переменной окружения DB_PATH
const dbPath = process.env.DB_PATH || fileURLToPath(new URL('../../data/app.db', import.meta.url));
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

// WAL: чтение не ждёт записи. foreign_keys: SQLite проверяет связи между таблицами.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Создаём таблицы, которых ещё нет
const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
db.exec(schema);
