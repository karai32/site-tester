// Проекты: список, дашборд проекта, аватарка, архив отчётов
import { dashboardData } from '../dashboard.js';
import { findProjectById, getProjects } from '../db/projects.js';
import { getScenarioReports } from '../db/reports.js';
import { findScenarioById } from '../db/scenarios.js';
import { listUrl, paginate, SORTS, sortFromQuery, toList } from '../lists.js';
import { saveProjectLogo } from '../project-actions.js';
import { listReports } from '../report-list.js';
import { categories as testCategories } from '../tests/index.js';

const REPORTS_PER_PAGE = 10;
const SUMMARY_BATCH = 10; // сколько отчётов подгружается за раз в сводке по сценарию

// Сообщения на дашборде после загрузки аватарки: ?logo=saved
const LOGO_NOTICES = {
  saved: { type: 'success', text: 'Аватарка обновлена' },
  error: { type: 'danger', text: 'Аватарка не загружена: нужна картинка PNG, JPEG или WebP не больше 2 МБ' },
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

    const data = dashboardData(project.id);

    return reply.view('projects/dashboard.ejs', {
      title: project.name,
      project,
      scenarios: data.scenarios,
      upcoming: data.upcoming,
      lastFull: data.lastFull,
      lastFullCategories: data.lastFullCategories,
      lastPartial: data.lastPartial,
      recentReports: data.recentReports,
      logoNotice: LOGO_NOTICES[request.query.logo],
      summaryScenarios: [...data.allScenarios].reverse(), // для «Сводки по сценарию»: все сценарии, новые сверху
    }, { layout: 'layouts/app.ejs' });
  });

  // Новая аватарка проекта: PNG, JPEG или WebP до 2 МБ
  app.post('/projects/:id/logo', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();
    const errorUrl = `/projects/${project.id}?logo=error`;

    // Файл из формы. Больше 2 МБ - toBuffer() выдаст ошибку.
    let data;
    try {
      const file = await request.file();
      if (!file) return reply.redirect(errorUrl);
      data = await file.toBuffer();
    } catch {
      return reply.redirect(errorUrl);
    }

    if (!saveProjectLogo(project, data)) return reply.redirect(errorUrl);
    return reply.redirect(`/projects/${project.id}?logo=saved`);
  });

  // Сводка по сценарию для дашборда. Отдаёт кусок HTML - его вставляет в страницу app.js.
  // ?scenario=5 - первые отчёты, ?scenario=5&offset=10 - следующие.
  app.get('/projects/:id/scenario-summary', async (request, reply) => {
    const project = findProjectById(request.params.id);
    const scenario = findScenarioById(request.query.scenario);
    if (!project || !scenario || scenario.project_id !== project.id) return reply.callNotFound();

    // Отчёты от самого недавнего до самого первого, порциями по SUMMARY_BATCH
    const reports = getScenarioReports(scenario.id);
    const offset = Number(request.query.offset) || 0;
    const batch = reports.slice(offset, offset + SUMMARY_BATCH);
    const remaining = reports.length - offset - batch.length;

    let nextUrl = null; // адрес следующей порции; null - отчёты кончились
    if (remaining > 0) {
      nextUrl = `/projects/${project.id}/scenario-summary?scenario=${scenario.id}&offset=${offset + SUMMARY_BATCH}`;
    }

    // Следующие порции - только строки отчётов
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
    const regular = String(request.query.regular || ''); // 'yes', 'no' или '' - все
    const selectedCategories = toList(request.query.cat);
    const sort = sortFromQuery(request.query.sort);

    const result = listReports(project.id, {
      search,
      author,
      categories: selectedCategories,
      regular,
      sort,
    });

    // Адрес архива с текущими фильтрами и изменениями: archiveUrl({ page: 2 })
    const currentFilters = { q: search, author, cat: selectedCategories, regular };
    if (sort !== 'new') currentFilters.sort = sort;
    const archiveUrl = (changes) => listUrl(`/projects/${project.id}/reports`, { ...currentFilters, ...changes });

    return reply.view('projects/reports.ejs', {
      title: `Архив отчётов - ${project.name}`,
      project,
      search,
      author,
      authors: result.authors,
      selectedCategories,
      categories: testCategories,
      regular,
      sort,
      sorts: SORTS,
      totalReports: result.total,
      pagination: paginate(result.reports, Number(request.query.page) || 1, REPORTS_PER_PAGE),
      archiveUrl,
    }, { layout: 'layouts/app.ejs' });
  });
}
