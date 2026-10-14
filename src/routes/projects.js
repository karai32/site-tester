// Проекты: список, дашборд проекта, архив отчётов
import { findProjectById, getProjects } from '../db/projects.js';
import { findLatestDoneReport, getProjectReports, getRecentReports, getReportResults } from '../db/reports.js';
import { getProjectScenarios } from '../db/scenarios.js';
import { authorName, formatDateTime } from '../helpers.js';
import { listUrl, paginate, toList, uniqueSorted } from '../lists.js';
import { groupByCategory } from '../report-summary.js';
import { scenarioCategoryIds } from '../scenario-info.js';
import { categories as testCategories } from '../tests/index.js';

const REPORTS_PER_PAGE = 10;

// Варианты сортировки архива: название и правило сравнения двух отчётов
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

    // Плитки категорий для сводки по последней полной проверке
    let lastFullCategories = [];
    if (lastFull) lastFullCategories = groupByCategory(getReportResults(lastFull.id));

    return reply.view('projects/dashboard.ejs', {
      title: project.name,
      project,
      scenarios,
      lastFull,
      lastFullCategories,
      lastPartial,
      recentReports: getRecentReports(project.id, 10),
    }, { layout: 'layouts/app.ejs' });
  });

  // Архив отчётов: поиск, фильтры по автору и категориям, сортировка, по 10 на странице
  app.get('/projects/:id/reports', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    // Параметры из адреса: ?q=...&author=...&cat=seo&cat=forms&sort=old&page=2
    const search = String(request.query.q || '').trim();
    const author = String(request.query.author || '');
    const selectedCategories = toList(request.query.cat);
    let sort = request.query.sort;
    if (!SORTS[sort]) sort = 'new';

    const allReports = getProjectReports(project.id);
    const scenarios = getProjectScenarios(project.id);
    const authors = uniqueSorted(allReports.map((report) => authorName(report.started_by_name)));

    let reports = allReports;

    if (search) {
      const needle = search.toLowerCase();
      reports = reports.filter((report) => {
        // Ищем по тому же тексту, что виден в списке: номер, сценарий, автор, дата
        const text = `#${report.id} ${report.scenario_name} ${authorName(report.started_by_name)} ${formatDateTime(report.finished_at)}`;
        return text.toLowerCase().includes(needle);
      });
    }

    if (author) {
      reports = reports.filter((report) => authorName(report.started_by_name) === author);
    }

    // Категории: оставляем отчёты, в сценарии которых есть все выбранные категории
    if (selectedCategories.length > 0) {
      reports = reports.filter((report) => {
        const scenario = scenarios.find((item) => item.id === report.scenario_id);
        const categoryIds = scenarioCategoryIds(scenario);
        return selectedCategories.every((id) => categoryIds.includes(id));
      });
    }

    reports.sort(SORTS[sort].compare);

    // Адрес архива с текущими фильтрами и изменениями: archiveUrl({ page: 2 })
    const currentFilters = { q: search, author, cat: selectedCategories };
    if (sort !== 'new') currentFilters.sort = sort;
    const archiveUrl = (changes) => listUrl(`/projects/${project.id}/reports`, { ...currentFilters, ...changes });

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
