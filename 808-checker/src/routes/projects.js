// Проекты: список и страница проекта с вкладками
import { findProjectById, getProjects } from '../db/projects.js';

export default async function projectRoutes(app) {
  // Список проектов
  app.get('/projects', async (_request, reply) => {
    const projects = getProjects();
    return reply.view('projects/list.ejs', { title: 'Проекты', projects }, { layout: 'layouts/app.ejs' });
  });

  // Вкладка «Дашборд»
  app.get('/projects/:id', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();
    return reply.view('projects/dashboard.ejs', { title: project.name, project, tab: 'dashboard' }, { layout: 'layouts/app.ejs' });
  });

  // Вкладка «Сценарии»
  app.get('/projects/:id/scenarios', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();
    return reply.view('projects/scenarios.ejs', { title: `Сценарии — ${project.name}`, project, tab: 'scenarios' }, { layout: 'layouts/app.ejs' });
  });

  // Вкладка «Архив отчётов»
  app.get('/projects/:id/reports', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();
    return reply.view('projects/reports.ejs', { title: `Архив отчётов — ${project.name}`, project, tab: 'reports' }, { layout: 'layouts/app.ejs' });
  });
}
