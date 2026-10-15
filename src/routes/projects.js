// Проекты: список, дашборд проекта, архив отчётов
import { findProjectById, getProjects } from '../db/projects.js';
import {
  findLatestDoneReport,
  getProjectReports,
  getRecentReports,
  getReportResults,
  getScenarioReports,
} from '../db/reports.js';
import { findScenarioById, getProjectScenarios } from '../db/scenarios.js';
import { authorName, formatDateTime } from '../helpers.js';
import { listUrl, paginate, SORTS, sortFromQuery, toList, uniqueSorted } from '../lists.js';
import { groupByCategory } from '../report-summary.js';
import { upcomingRuns } from '../schedule.js';
import { scenarioCategoryIds, scenarioSummary } from '../scenario-info.js';
import { categories as testCategories } from '../tests/index.js';

const REPORTS_PER_PAGE = 10;
const UPCOMING_COUNT = 5; // сколько ближайших проверок показывать на дашборде (по ТЗ — 5)
const SUMMARY_BATCH = 10; // сколько отчётов подгружается за раз в сводке по сценарию

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

    // Активные сценарии и их состав — для окна подтверждения запуска
    const allScenarios = getProjectScenarios(project.id);
    const scenarios = [];
    for (const scenario of allScenarios) {
      if (scenario.is_active) scenarios.push({ ...scenario, summary: scenarioSummary(scenario) });
    }
    // Ближайшие проверки: отложенные и регулярные всех активных сценариев, по времени
    let upcoming = [];
    for (const scenario of scenarios) {
      upcoming.push(...upcomingRuns(scenario, UPCOMING_COUNT));
    }
    upcoming.sort((a, b) => a.runAt.localeCompare(b.runAt));
    upcoming = upcoming.slice(0, UPCOMING_COUNT);

    const lastFull = findLatestDoneReport(project.id, true);
    const lastPartial = findLatestDoneReport(project.id, false);

    // Плитки категорий для сводки по последней полной проверке
    let lastFullCategories = [];
    if (lastFull) lastFullCategories = groupByCategory(getReportResults(lastFull.id));

    return reply.view('projects/dashboard.ejs', {
      title: project.name,
      project,
      scenarios,
      upcoming,
      lastFull,
      lastFullCategories,
      lastPartial,
      recentReports: getRecentReports(project.id, 10),
      summaryScenarios: [...allScenarios].reverse(), // для «Сводки по сценарию»: все сценарии, новые сверху
    }, { layout: 'layouts/app.ejs' });
  });

  // Сводка по сценарию для дашборда. Отдаёт кусок HTML — его вставляет в страницу app.js.
  // ?scenario=5 — первые отчёты, ?scenario=5&offset=10 — следующие.
  app.get('/projects/:id/scenario-summary', async (request, reply) => {
    const project = findProjectById(request.params.id);
    const scenario = findScenarioById(request.query.scenario);
    if (!project || !scenario || scenario.project_id !== project.id) return reply.callNotFound();

    // Отчёты от самого недавнего до самого первого, порциями по SUMMARY_BATCH
    const reports = getScenarioReports(scenario.id);
    const offset = Number(request.query.offset) || 0;
    const batch = reports.slice(offset, offset + SUMMARY_BATCH);
    const remaining = reports.length - offset - batch.length;

    let nextUrl = null; // адрес следующей порции; null — отчёты кончились
    if (remaining > 0) {
      nextUrl = `/projects/${project.id}/scenario-summary?scenario=${scenario.id}&offset=${offset + SUMMARY_BATCH}`;
    }

    // Следующие порции — только строки отчётов
    if (offset > 0) {
      return reply.view('partials/scenario-summary-rows.ejs', { reports: batch, remaining, nextUrl });
    }

    return reply.view('partials/scenario-summary.ejs', { reports: batch, remaining, nextUrl });
  });

  // Архив отчётов: поиск, фильтры по автору и категориям, сортировка, по 10 на странице
  app.get('/projects/:id/reports', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    // Параметры из адреса: ?q=...&author=...&cat=seo&cat=forms&regular=yes&sort=old&page=2
    const search = String(request.query.q || '').trim();
    const author = String(request.query.author || '');
    const regular = String(request.query.regular || ''); // 'yes', 'no' или '' — все
    const selectedCategories = toList(request.query.cat);
    const sort = sortFromQuery(request.query.sort);

    // Отчёты с цифрами для фильтров и сортировки: категории сценария, число тестов и страниц
    const scenarios = getProjectScenarios(project.id);
    const allReports = [];
    for (const report of getProjectReports(project.id)) {
      const scenario = scenarios.find((item) => item.id === report.scenario_id);
      const categoryIds = scenarioCategoryIds(scenario);
      allReports.push({
        ...report,
        categoryIds,
        categoriesCount: categoryIds.length,
        testsCount: report.tests_total || 0,
        pagesCount: report.pages_count || 0,
      });
    }
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
      reports = reports.filter((report) => selectedCategories.every((id) => report.categoryIds.includes(id)));
    }

    // Регулярность: проверку поставило расписание сценария или нет
    if (regular === 'yes') reports = reports.filter((report) => report.is_regular);
    if (regular === 'no') reports = reports.filter((report) => !report.is_regular);

    reports.sort(SORTS[sort].compare);

    // Адрес архива с текущими фильтрами и изменениями: archiveUrl({ page: 2 })
    const currentFilters = { q: search, author, cat: selectedCategories, regular };
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
      regular,
      sort,
      sorts: SORTS,
      totalReports: allReports.length,
      pagination: paginate(reports, Number(request.query.page) || 1, REPORTS_PER_PAGE),
      archiveUrl,
    }, { layout: 'layouts/app.ejs' });
  });
}
