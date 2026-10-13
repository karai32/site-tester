// Очередь проверок. Раз в несколько секунд берёт самый старый отчёт со статусом queued
// и запускает его. Проверки идут строго по одной: серверу не хватит памяти на две сразу.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '../config.js';
import { findNextQueuedReport, markInterruptedReports } from '../db/reports.js';
import { runCheck } from './run-check.js';

const CHECK_EVERY_MS = 5000;
let busy = false;

export function startQueue(log) {
  // Проверки, которые шли до перезапуска сервера, уже не продолжатся
  markInterruptedReports();
  rmSync(join(DATA_DIR, 'cache'), { recursive: true, force: true });

  setInterval(async () => {
    if (busy) return;
    const report = findNextQueuedReport();
    if (!report) return;

    busy = true;
    try {
      await runCheck(report.id, log);
    } finally {
      busy = false;
    }
  }, CHECK_EVERY_MS);
}
