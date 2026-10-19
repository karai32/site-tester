// Отчёты: запуск проверки, страница отчёта, скачивание
import { findProjectById } from '../db/projects.js';
import { cancelReport, createReport } from '../db/reports.js';
import { findScenarioById } from '../db/scenarios.js';
import { loadReport, sendReportDownload } from '../report-data.js';

export default async function reportRoutes(app) {
  // Запуск проверки (форма в дашборде проекта): отчёт встаёт в очередь
  app.post('/projects/:id/checks', async (request, reply) => {
    const project = findProjectById(request.params.id);
    const form = request.body || {};
    const scenario = findScenarioById(form.scenario_id);
    if (!project || !scenario || scenario.project_id !== project.id) return reply.callNotFound();
    // Выключенный сценарий не запускается: сначала его нужно включить на странице сценария
    if (!scenario.is_active) return reply.redirect(`/projects/${project.id}/scenarios/${scenario.id}`);

    const reportId = createReport({ projectId: project.id, scenarioId: scenario.id, startedBy: reply.locals.user.id });
    return reply.redirect(`/reports/${reportId}`);
  });

  // Отмена проверки: из очереди убирается сразу, идущая останавливается перед следующим тестом
  app.post('/reports/:id/cancel', async (request, reply) => {
    const data = loadReport(request.params.id);
    if (!data) return reply.callNotFound();
    cancelReport(data.report.id);
    return reply.redirect(`/reports/${data.report.id}`);
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
    return sendReportDownload(reply, data);
  });
}
