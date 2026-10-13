// Профиль вошедшего пользователя
export default async function profileRoutes(app) {
  app.get('/profile', async (_request, reply) => {
    return reply.view('profile.ejs', { title: 'Профиль' }, { layout: 'layouts/app.ejs' });
  });
}
