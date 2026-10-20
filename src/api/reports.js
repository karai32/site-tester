// Отчёты: архив проекта с фильтрами, отчёт целиком, скачивание HTML, скриншоты и видео
import { findProjectById } from '../db/projects.js';
import { cancelReport, findReportWithNames } from '../db/reports.js';
import { loadReport, sendReportDownload } from '../report-data.js';
import { listReports } from '../report-list.js';
import { MEDIA_DIR } from '../config.js';
import { formatFullReport, formatReport } from './format.js';
import { listFilters, pageOf } from './lists.js';
import { sendData, sendError } from './response.js';

export default async function reportsApi(app) {
  // Архив отчётов, как на странице «Архив отчётов»:
  // ?q=...&author=...&categories=seo&regular=yes&sort=old&page=1&perPage=10
  app.get('/projects/:id/reports', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return sendError(reply, 404, 'not_found', 'Проект не найден');

    const filters = { ...listFilters(request.query), search: String(request.query.q || '').trim() };
    const result = listReports(project.id, filters);
    const { items, meta } = pageOf(result.reports, request.query);

    return sendData(reply, items.map(formatReport), {
      ...meta,
      authors: result.authors, // значения для фильтра author (автор сценария)
    });
  });

  // Отчёт целиком: статус и прогресс, результаты тестов по категориям
  app.get('/reports/:id', async (request, reply) => {
    const data = loadReport(request.params.id);
    if (!data) return sendError(reply, 404, 'not_found', 'Отчёт не найден');
    return sendData(reply, formatFullReport(data.report, data.categories));
  });

  // Отменить проверку: из очереди убирается сразу, идущая останавливается перед следующим тестом
  app.post('/reports/:id/cancel', async (request, reply) => {
    const report = findReportWithNames(request.params.id);
    if (!report) return sendError(reply, 404, 'not_found', 'Отчёт не найден');
    if (report.status !== 'queued' && report.status !== 'running') {
      return sendError(reply, 409, 'conflict', 'Проверка уже закончилась');
    }

    cancelReport(report.id);
    return sendData(reply, formatReport(findReportWithNames(report.id)));
  });

  // Отчёт одним HTML-файлом - тот же, что кнопка «Скачать» в сервисе
  app.get('/reports/:id/download', async (request, reply) => {
    const data = loadReport(request.params.id);
    if (!data) return sendError(reply, 404, 'not_found', 'Отчёт не найден');
    return sendReportDownload(reply, data);
  });

  // Скриншоты, видео и аватарки: адреса берутся из ответов API (поля url, logoUrl)
  app.get('/media/*', async (request, reply) => {
    return reply.sendFile(request.params['*'], MEDIA_DIR); // за пределы папки media не выйти
  });
}
