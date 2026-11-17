import { findProjectById, getProjects } from '../db/projects.js';
import { getScenarioReports } from '../db/reports.js';
import { findScenarioById } from '../db/scenarios.js';
import { listUrl, paginate, sortFromQuery, SORTS, toList } from '../logic/lists.js';
import { dashboardData, saveProjectLogo } from '../logic/projects.js';
import { listReports } from '../logic/reports.js';
import { projectCategories } from '../logic/scenarios.js';

const REPORTS_PER_PAGE = 10;
const SUMMARY_BATCH = 10;

const LOGO_NOTICES = {
  saved: { type: 'success', text: 'Аватарка обновлена' },
  error: { type: 'danger', text: 'Аватарка не загружена: нужна картинка PNG, JPEG или WebP не больше 2 МБ' },
};

export default async function projectPages(app) {
  app.get('/projects', async (_request, reply) => {
    const projects = getProjects();
    return reply.view('projects/list.ejs', { title: 'Проекты', projects }, { layout: 'layouts/app.ejs' });
  });

  app.get('/projects/:id', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const data = dashboardData(project.id);

    return reply.view('projects/dashboard.ejs', {
      title: project.name,
      project,
      ...data,
      logoNotice: LOGO_NOTICES[request.query.logo],
      summaryScenarios: [...data.allScenarios].reverse(),
    }, { layout: 'layouts/app.ejs' });
  });

  app.post('/projects/:id/logo', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const saved = await saveProjectLogo(project, request);
    if (!saved) return reply.redirect(`/projects/${project.id}?logo=error`);
    return reply.redirect(`/projects/${project.id}?logo=saved`);
  });

  app.get('/projects/:id/scenario-summary', async (request, reply) => {
    const project = findProjectById(request.params.id);
    const scenario = findScenarioById(request.query.scenario);
    if (!project || !scenario || scenario.project_id !== project.id) return reply.callNotFound();

    const reports = getScenarioReports(scenario.id);
    const offset = Number(request.query.offset) || 0;
    const batch = reports.slice(offset, offset + SUMMARY_BATCH);
    const remaining = reports.length - offset - batch.length;

    let nextUrl = null;
    if (remaining > 0) {
      nextUrl = `/projects/${project.id}/scenario-summary?scenario=${scenario.id}&offset=${offset + SUMMARY_BATCH}`;
    }

    if (offset > 0) {
      return reply.view('partials/scenario-summary-rows.ejs', { reports: batch, remaining, nextUrl });
    }

    return reply.view('partials/scenario-summary.ejs', { reports: batch, remaining, nextUrl });
  });

  app.get('/projects/:id/reports', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const search = String(request.query.q || '').trim();
    const author = String(request.query.author || '');
    const regular = String(request.query.regular || '');
    const selectedCategories = toList(request.query.cat);
    const sort = sortFromQuery(request.query.sort);

    const result = listReports(project.id, {
      search,
      author,
      categories: selectedCategories,
      regular,
      sort,
    });

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
      categories: projectCategories(project.id),
      regular,
      sort,
      sorts: SORTS,
      totalReports: result.total,
      pagination: paginate(result.reports, Number(request.query.page) || 1, REPORTS_PER_PAGE),
      archiveUrl,
    }, { layout: 'layouts/app.ejs' });
  });
}
