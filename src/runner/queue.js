import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '../config.js';
import { findNextQueuedReport, markInterruptedReports } from '../db/reports.js';
import { runCheck } from './run-check.js';
import { queueDueChecks } from './scheduler.js';

const CHECK_EVERY_MS = 5000;
let busy = false;

export function startQueue(log) {
  markInterruptedReports();
  rmSync(join(DATA_DIR, 'cache'), { recursive: true, force: true });

  setInterval(async () => {
    try {
      queueDueChecks(log);
    } catch (error) {
      log.error(error, 'Не удалось поставить проверки по расписанию');
    }

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
