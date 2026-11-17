import { MEDIA_DIR } from '../config.js';
import { findProjectById } from '../db/projects.js';
import { cancelReport, findReportWithNames } from '../db/reports.js';
import { listReports, loadReport, sendReportDownload } from '../logic/reports.js';
import { formatFullReport, formatReport, listFilters, pageOf, sendData, sendError } from './json.js';

export default async function reportsApi(app) {
  app.get('/projects/:id/reports', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return sendError(reply, 404, 'not_found', 'Проект не найден');

    const filters = { ...listFilters(request.query), search: String(request.query.q || '').trim() };
    const result = listReports(project.id, filters);
    const { items, meta } = pageOf(result.reports, request.query);

    return sendData(reply, items.map(formatReport), {
      ...meta,
      authors: result.authors,
    });
  });

  app.get('/reports/:id', async (request, reply) => {
    const data = loadReport(request.params.id);
    if (!data) return sendError(reply, 404, 'not_found', 'Отчёт не найден');
    return sendData(reply, formatFullReport(data.report, data.categories));
  });

  app.post('/reports/:id/cancel', async (request, reply) => {
    const report = findReportWithNames(request.params.id);
    if (!report) return sendError(reply, 404, 'not_found', 'Отчёт не найден');
    if (report.status !== 'queued' && report.status !== 'running') {
      return sendError(reply, 409, 'conflict', 'Проверка уже закончилась');
    }

    cancelReport(report.id);
    return sendData(reply, formatReport(findReportWithNames(report.id)));
  });

  app.get('/reports/:id/download', async (request, reply) => {
    const data = loadReport(request.params.id);
    if (!data) return sendError(reply, 404, 'not_found', 'Отчёт не найден');
    return sendReportDownload(reply, data);
  });

  app.get('/media/*', async (request, reply) => {
    return reply.sendFile(request.params['*'], MEDIA_DIR);
  });
}
