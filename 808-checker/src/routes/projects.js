// Проекты: список и страница проекта с вкладками
import { findProjectById, getProjects } from '../db/projects.js';
import { getProjectReports, getRecentReports } from '../db/reports.js';
import { getProjectScenarios } from '../db/scenarios.js';
import { authorName, formatDateTime } from '../helpers.js';
import { paginate } from '../pagination.js';

const REPORTS_PER_PAGE = 10;

export default async function projectRoutes(app) {
  // Список проектов
  app.get('/projects', async (_request, reply) => {
    const projects = getProjects();
    return reply.view('projects/list.ejs', { title: 'Проекты', projects }, { layout: 'layouts/app.ejs' });
  });

  // Вкладка «Дашборд»: запуск проверки и последние отчёты
  app.get('/projects/:id', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const scenarios = getProjectScenarios(project.id).filter((scenario) => scenario.is_active);
    const recentReports = getRecentReports(project.id, 10);
    return reply.view('projects/dashboard.ejs', { title: project.name, project, tab: 'dashboard', scenarios, recentReports }, { layout: 'layouts/app.ejs' });
  });

  // Вкладка «Сценарии»
  app.get('/projects/:id/scenarios', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();
    return reply.view('projects/scenarios.ejs', { title: `Сценарии — ${project.name}`, project, tab: 'scenarios' }, { layout: 'layouts/app.ejs' });
  });

  // Вкладка «Архив отчётов»: поиск по сценарию, автору и дате, по 10 отчётов на странице
  app.get('/projects/:id/reports', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const search = String(request.query.q || '').trim();
    let reports = getProjectReports(project.id);
    if (search) {
      const needle = search.toLowerCase();
      reports = reports.filter((report) => {
        // Ищем по тому же тексту, что виден в таблице
        const text = `#${report.id} ${report.scenario_name} ${authorName(report.started_by_name)} ${formatDateTime(report.finished_at)}`;
        return text.toLowerCase().includes(needle);
      });
    }

    const pagination = paginate(reports, Number(request.query.page) || 1, REPORTS_PER_PAGE);
    // Адрес страницы архива с тем же поиском
    const pageUrl = (page) => `/projects/${project.id}/reports?${new URLSearchParams(search ? { q: search, page } : { page })}`;

    return reply.view('projects/reports.ejs', {
      title: `Архив отчётов — ${project.name}`,
      project,
      tab: 'reports',
      search,
      pagination,
      pageUrl,
    }, { layout: 'layouts/app.ejs' });
  });
}
