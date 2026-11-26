import { dashboardData, saveProjectLogo } from '../logic/projects.js';

const LOGO_NOTICES = {
  saved: { type: 'success', text: 'Аватарка обновлена' },
  error: { type: 'danger', text: 'Аватарка не загружена: нужна картинка PNG, JPEG или WebP не больше 2 МБ' },
};

export default async function projectPages(app) {
  app.get('/project', async (request, reply) => {
    const data = dashboardData(request.project.id);

    return reply.view('project.ejs', {
      title: request.project.name,
      ...data,
      logoNotice: LOGO_NOTICES[request.query.logo],
      summaryScenarios: [...data.allScenarios].reverse(),
    }, { layout: 'layouts/app.ejs' });
  });

  app.post('/project/logo', async (request, reply) => {
    const saved = await saveProjectLogo(request.project, request);
    if (!saved) return reply.redirect('/project?logo=error');
    return reply.redirect('/project?logo=saved');
  });
}
