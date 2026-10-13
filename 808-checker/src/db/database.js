// Подключение к базе SQLite. Остальные файлы папки db берут отсюда `db`.
import { readdirSync, readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { DB_PATH } from '../config.js';

export const db = new Database(DB_PATH);

// WAL: чтение не ждёт записи. foreign_keys: SQLite проверяет связи между таблицами.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Миграции: файлы migrations/NNN-название.sql выполняются по порядку номеров, каждый один раз.
// Номер последней выполненной миграции SQLite хранит в user_version.
// Чтобы изменить базу, добавьте новый файл со следующим номером. Старые файлы не меняйте.
const migrationsDir = new URL('./migrations/', import.meta.url);
const doneVersion = db.pragma('user_version', { simple: true });

for (const file of readdirSync(migrationsDir).sort()) {
  const version = parseInt(file, 10);
  if (!(version > doneVersion)) continue;

  const sql = readFileSync(new URL(file, migrationsDir), 'utf8');
  db.transaction(() => {
    db.exec(sql);
    db.pragma(`user_version = ${version}`);
  })();
}
