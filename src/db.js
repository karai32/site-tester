import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDatabasePath = fileURLToPath(
  new URL('../data/site-checker.sqlite', import.meta.url),
);
const databasePath = resolve(process.env.SQLITE_PATH || defaultDatabasePath);
const maxStoredScans = Math.min(
  Math.max(Number.parseInt(process.env.MAX_STORED_SCANS || '30', 10) || 30, 1),
  1000,
);

mkdirSync(dirname(databasePath), { recursive: true });

const database = new Database(databasePath);
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');

database.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'passed', 'failed')),
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    report_json TEXT,
    error TEXT
  );
`);

const createScanStatement = database.prepare(`
  INSERT INTO scans (target_url, status, created_at)
  VALUES (?, 'pending', ?)
`);

const getScanStatement = database.prepare(`
  SELECT * FROM scans WHERE id = ?
`);

const getActiveScanStatement = database.prepare(`
  SELECT *
  FROM scans
  WHERE status IN ('pending', 'running')
  ORDER BY id DESC
  LIMIT 1
`);

const listScansStatement = database.prepare(`
  SELECT id, target_url, status, created_at, started_at, finished_at, error
  FROM scans
  ORDER BY id DESC
  LIMIT ?
`);

const markRunningStatement = database.prepare(`
  UPDATE scans
  SET status = 'running', started_at = ?
  WHERE id = ?
`);

const finishScanStatement = database.prepare(`
  UPDATE scans
  SET status = ?, finished_at = ?, report_json = ?, error = ?
  WHERE id = ?
`);

const recoverScansStatement = database.prepare(`
  UPDATE scans
  SET status = 'failed', finished_at = ?, error = ?
  WHERE status IN ('pending', 'running')
`);

const deleteOldScansStatement = database.prepare(`
  DELETE FROM scans
  WHERE id NOT IN (
    SELECT id
    FROM scans
    ORDER BY id DESC
    LIMIT ?
  )
`);

function parseReport(scan) {
  if (!scan) {
    return null;
  }

  const { report_json: reportJson, ...scanWithoutRawReport } = scan;

  if (!reportJson) {
    return { ...scanWithoutRawReport, report: null };
  }

  try {
    return { ...scanWithoutRawReport, report: JSON.parse(reportJson) };
  } catch {
    return { ...scanWithoutRawReport, report: { raw: reportJson } };
  }
}

export function createScan(targetUrl) {
  const result = createScanStatement.run(targetUrl, new Date().toISOString());
  return getScan(Number(result.lastInsertRowid));
}

export function getScan(id) {
  return parseReport(getScanStatement.get(id));
}

export function getActiveScan() {
  return getActiveScanStatement.get() || null;
}

export function listScans(limit = 30) {
  return listScansStatement.all(Math.min(Math.max(limit, 1), 100));
}

export function markScanRunning(id) {
  markRunningStatement.run(new Date().toISOString(), id);
}

export function finishScan(id, { passed, report, error = null }) {
  finishScanStatement.run(
    passed ? 'passed' : 'failed',
    new Date().toISOString(),
    report ? JSON.stringify(report) : null,
    error,
    id,
  );

  deleteOldScansStatement.run(maxStoredScans);
}

export function recoverInterruptedScans() {
  recoverScansStatement.run(
    new Date().toISOString(),
    'Проверка была прервана перезапуском приложения.',
  );
}

export function closeDatabase() {
  database.close();
}
