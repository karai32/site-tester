import { cancelReport } from '../db/reports.js';
import { listUrl, paginate, sortFromQuery, SORTS, toList } from '../logic/lists.js';
import { listReports, loadReport, sendReportDownload } from '../logic/reports.js';
import { projectCategories } from '../logic/scenarios.js';

const REPORTS_PER_PAGE = 10;

export default async function reportPages(app) {
  app.get('/reports', async (request, reply) => {
    const project = request.project;
    const search = String(request.query.q || '').trim();
    const regular = String(request.query.regular || '');
    const selectedCategories = toList(request.query.cat);
    const sort = sortFromQuery(request.query.sort);

    const result = listReports(project.id, { search, categories: selectedCategories, regular, sort });

    const currentFilters = { q: search, cat: selectedCategories, regular };
    if (sort !== 'new') currentFilters.sort = sort;
    const archiveUrl = (changes) => listUrl('/reports', { ...currentFilters, ...changes });

    return reply.view('reports/list.ejs', {
      title: `Архив отчётов - ${project.name}`,
      search,
      selectedCategories,
      categories: projectCategories(project.id),
      regular,
      sort,
      sorts: SORTS,
      totalReports: result.total,
      pagination: paginate(result.reports, Number(request.query.page) || 1, REPORTS_PER_PAGE),
      archiveUrl,
    }, { layout: 'layouts/app.ejs' });
  });

  app.get('/reports/:id', async (request, reply) => {
    const data = loadReport(request.params.id);
    return reply.view('reports/show.ejs', { title: `Отчёт #${data.report.id}`, ...data }, { layout: 'layouts/app.ejs' });
  });

  app.post('/reports/:id/cancel', async (request, reply) => {
    cancelReport(request.params.id);
    return reply.redirect(`/reports/${request.params.id}`);
  });

  app.get('/reports/:id/download', async (request, reply) => {
    return sendReportDownload(reply, loadReport(request.params.id));
  });
}
