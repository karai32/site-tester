// Проекты: список, дашборд проекта, сценарии, архив отчётов
import { findProjectById, getProjects } from '../db/projects.js';
import { findLatestDoneReport, getProjectReports, getRecentReports, getReportResults } from '../db/reports.js';
import { getProjectScenarios } from '../db/scenarios.js';
import { authorName, formatDateTime } from '../helpers.js';
import { paginate } from '../pagination.js';
import { groupByCategory, scenarioCategoryIds } from '../report-summary.js';
import { categories as testCategories } from '../tests/index.js';

const REPORTS_PER_PAGE = 10;

// Сортировка архива: id → подпись и порядок
const SORTS = {
  new: { title: 'По дате: сначала новые', compare: (a, b) => b.id - a.id },
  old: { title: 'По дате: сначала старые', compare: (a, b) => a.id - b.id },
  tests: { title: 'По числу тестов', compare: (a, b) => (b.tests_total || 0) - (a.tests_total || 0) },
  pages: { title: 'По числу страниц', compare: (a, b) => (b.pages_count || 0) - (a.pages_count || 0) },
};

export default async function projectRoutes(app) {
  // Список проектов
  app.get('/projects', async (_request, reply) => {
    const projects = getProjects();
    return reply.view('projects/list.ejs', { title: 'Проекты', projects }, { layout: 'layouts/app.ejs' });
  });

  // Дашборд проекта: запуск сценариев, сводки по последним проверкам, последние отчёты
  app.get('/projects/:id', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const scenarios = getProjectScenarios(project.id).filter((scenario) => scenario.is_active);
    const lastFull = findLatestDoneReport(project.id, true);
    const lastPartial = findLatestDoneReport(project.id, false);

    return reply.view('projects/dashboard.ejs', {
      title: project.name,
      project,
      scenarios,
      lastFull,
      lastFullCategories: lastFull ? groupByCategory(getReportResults(lastFull.id)) : [],
      lastPartial,
      recentReports: getRecentReports(project.id, 10),
    }, { layout: 'layouts/app.ejs' });
  });

  // Сценарии (страница появится на следующем шаге)
  app.get('/projects/:id/scenarios', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();
    return reply.view('projects/scenarios.ejs', { title: `Сценарии — ${project.name}`, project }, { layout: 'layouts/app.ejs' });
  });

  // Архив отчётов: поиск, фильтры по автору и категориям, сортировка, по 10 на странице
  app.get('/projects/:id/reports', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    // Параметры из адреса: ?q=...&author=...&cat=seo&cat=forms&sort=old&page=2
    const search = String(request.query.q || '').trim();
    const author = String(request.query.author || '');
    const selectedCategories = [request.query.cat || []].flat();
    const sort = SORTS[request.query.sort] ? request.query.sort : 'new';

    const allReports = getProjectReports(project.id);
    const authors = [...new Set(allReports.map((report) => authorName(report.started_by_name)))].sort();

    let reports = allReports;
    if (search) {
      const needle = search.toLowerCase();
      reports = reports.filter((report) => {
        // Ищем по тому же тексту, что виден в списке
        const text = `#${report.id} ${report.scenario_name} ${authorName(report.started_by_name)} ${formatDateTime(report.finished_at)}`;
        return text.toLowerCase().includes(needle);
      });
    }
    if (author) {
      reports = reports.filter((report) => authorName(report.started_by_name) === author);
    }
    if (selectedCategories.length > 0) {
      // Сценарий отчёта содержит все выбранные категории
      reports = reports.filter((report) => {
        const ids = scenarioCategoryIds({ is_full: report.scenario_is_full, test_ids: JSON.parse(report.scenario_test_ids) });
        return selectedCategories.every((id) => ids.includes(id));
      });
    }
    reports = [...reports].sort(SORTS[sort].compare);

    // Адрес архива с текущими параметрами и изменениями: archiveUrl({ page: 2 })
    const current = { q: search, author, cat: selectedCategories, sort: sort === 'new' ? '' : sort };
    const archiveUrl = (changes) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries({ ...current, page: '', ...changes })) {
        for (const item of [value].flat()) if (item) params.append(key, item);
      }
      const query = params.toString();
      return `/projects/${project.id}/reports${query ? `?${query}` : ''}`;
    };

    return reply.view('projects/reports.ejs', {
      title: `Архив отчётов — ${project.name}`,
      project,
      search,
      author,
      authors,
      selectedCategories,
      categories: testCategories,
      sort,
      sorts: SORTS,
      totalReports: allReports.length,
      pagination: paginate(reports, Number(request.query.page) || 1, REPORTS_PER_PAGE),
      archiveUrl,
    }, { layout: 'layouts/app.ejs' });
  });
}
