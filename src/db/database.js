import { readdirSync, readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { DB_PATH } from '../config.js';

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const migrationsDir = new URL('./migrations/', import.meta.url);
const doneVersion = db.pragma('user_version', { simple: true });

for (const file of readdirSync(migrationsDir).sort()) {
  if (!file.endsWith('.sql')) continue;

  const version = parseInt(file, 10);
  if (version <= doneVersion) continue;

  const sql = readFileSync(new URL(file, migrationsDir), 'utf8');
  db.transaction(() => {
    db.exec(sql);
    db.pragma(`user_version = ${version}`);
  })();
}
