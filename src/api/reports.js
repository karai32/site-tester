import { MEDIA_DIR } from '../config.js';
import { cancelReport, findReportById } from '../db/reports.js';
import { listReports, loadReport, sendReportDownload } from '../logic/reports.js';
import { formatFullReport, formatReport, listFilters, pageOf, sendData, sendError } from './json.js';

export default async function reportsApi(app) {
  app.get('/reports', async (request, reply) => {
    const filters = { ...listFilters(request.query), search: String(request.query.q || '').trim() };
    const result = listReports(request.project.id, filters);
    const { items, meta } = pageOf(result.reports, request.query);
    return sendData(reply, items.map(formatReport), meta);
  });

  app.get('/reports/:id', async (request, reply) => {
    const data = loadReport(request.params.id);
    return sendData(reply, formatFullReport(data.report, data.categories));
  });

  app.post('/reports/:id/cancel', async (request, reply) => {
    const report = findReportById(request.params.id);
    if (report.status !== 'queued' && report.status !== 'running') {
      return sendError(reply, 409, 'conflict', 'Проверка уже закончилась');
    }

    cancelReport(report.id);
    return sendData(reply, formatReport(findReportById(report.id)));
  });

  app.get('/reports/:id/download', async (request, reply) => {
    return sendReportDownload(reply, loadReport(request.params.id));
  });

  app.get('/media/*', async (request, reply) => {
    return reply.sendFile(request.params['*'], MEDIA_DIR);
  });
}
