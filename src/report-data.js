// Отчёт со всеми данными - общий для страницы отчёта, скачивания и API.
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { MEDIA_DIR } from './config.js';
import { findProjectById } from './db/projects.js';
import { findReportWithNames, getReportResults } from './db/reports.js';
import { groupByCategory } from './report-summary.js';

// Отчёт, проект и результаты, сгруппированные по категориям в порядке запуска. Нет отчёта - null.
export function loadReport(reportId) {
  const report = findReportWithNames(reportId);
  if (!report) return null;
  return {
    report,
    project: findProjectById(report.project_id),
    categories: groupByCategory(getReportResults(report.id)),
  };
}

// Файл из папки media как data:-адрес, чтобы скачанный отчёт открывался без сервера
const mimeTypes = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webm': 'video/webm' };
function mediaDataUrl(file) {
  try {
    const data = readFileSync(join(MEDIA_DIR, file));
    return `data:${mimeTypes[extname(file)]};base64,${data.toString('base64')}`;
  } catch {
    return null; // файл удалили - в отчёте его просто не будет
  }
}

// Отчёт одним HTML-файлом со встроенными скриншотами - ответ на запрос скачивания
export function sendReportDownload(reply, data) {
  for (const category of data.categories) {
    for (const result of category.results) {
      for (const item of result.media) item.dataUrl = mediaDataUrl(item.file);
    }
  }

  reply.header('Content-Disposition', `attachment; filename="report-${data.report.id}.html"`);
  return reply.view('reports/download.ejs', { title: `Отчёт #${data.report.id}`, ...data });
}
