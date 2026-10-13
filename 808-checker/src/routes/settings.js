// Настройки сервиса
export default async function settingsRoutes(app) {
  app.get('/settings', async (_request, reply) => {
    return reply.view('settings.ejs', { title: 'Настройки' }, { layout: 'layouts/app.ejs' });
  });
}
