import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { MEDIA_DIR } from './config.js';
import { findProjectById } from './db/projects.js';
import { findReportWithNames, getReportResults } from './db/reports.js';
import { groupByCategory } from './report-summary.js';

export function loadReport(reportId) {
  const report = findReportWithNames(reportId);
  if (!report) return null;
  return {
    report,
    project: findProjectById(report.project_id),
    categories: groupByCategory(getReportResults(report.id)),
  };
}

const mimeTypes = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webm': 'video/webm' };
function mediaDataUrl(file) {
  try {
    const data = readFileSync(join(MEDIA_DIR, file));
    return `data:${mimeTypes[extname(file)]};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}

export function sendReportDownload(reply, data) {
  for (const category of data.categories) {
    for (const result of category.results) {
      for (const item of result.media) item.dataUrl = mediaDataUrl(item.file);
    }
  }

  reply.header('Content-Disposition', `attachment; filename="report-${data.report.id}.html"`);
  return reply.view('reports/download.ejs', { title: `Отчёт #${data.report.id}`, ...data });
}
