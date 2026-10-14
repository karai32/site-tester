// Отчёты: запуск проверки, страница отчёта, скачивание
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { MEDIA_DIR } from '../config.js';
import { findProjectById } from '../db/projects.js';
import { createReport, findReportWithNames, getReportResults } from '../db/reports.js';
import { findScenarioById } from '../db/scenarios.js';
import { groupByCategory } from '../report-summary.js';

// Отчёт, проект и результаты, сгруппированные по категориям в порядке запуска
function loadReport(reportId) {
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
    return null; // файл удалили — в отчёте его просто не будет
  }
}

export default async function reportRoutes(app) {
  // Запуск проверки (форма в дашборде проекта): отчёт встаёт в очередь
  app.post('/projects/:id/checks', async (request, reply) => {
    const project = findProjectById(request.params.id);
    const scenario = findScenarioById(request.body?.scenario_id);
    if (!project || !scenario || scenario.project_id !== project.id) return reply.callNotFound();

    const reportId = createReport({ projectId: project.id, scenarioId: scenario.id, startedBy: reply.locals.user.id });
    return reply.redirect(`/reports/${reportId}`);
  });

  // Страница отчёта
  app.get('/reports/:id', async (request, reply) => {
    const data = loadReport(request.params.id);
    if (!data) return reply.callNotFound();
    return reply.view('reports/show.ejs', { title: `Отчёт #${data.report.id}`, ...data }, { layout: 'layouts/app.ejs' });
  });

  // Скачивание отчёта одним HTML-файлом со встроенными скриншотами
  app.get('/reports/:id/download', async (request, reply) => {
    const data = loadReport(request.params.id);
    if (!data) return reply.callNotFound();

    for (const category of data.categories) {
      for (const result of category.results) {
        for (const item of result.media) item.dataUrl = mediaDataUrl(item.file);
      }
    }

    reply.header('Content-Disposition', `attachment; filename="report-${data.report.id}.html"`);
    return reply.view('reports/download.ejs', { title: `Отчёт #${data.report.id}`, ...data });
  });
}
