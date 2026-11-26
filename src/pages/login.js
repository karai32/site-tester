import { findProjectByLogin } from '../db/projects.js';
import { checkPassword, logIn, logOut } from '../logic/auth.js';

export default async function loginPages(app) {
  app.get('/login', async (request, reply) => {
    if (request.project) return reply.redirect('/');
    return reply.view('login.ejs', { title: 'Вход', login: '', error: false }, { layout: 'layouts/auth.ejs' });
  });

  app.post('/login', async (request, reply) => {
    const form = request.body || {};
    const login = String(form.login || '').trim();
    const password = String(form.password || '');

    const project = findProjectByLogin(login);
    if (!project || !checkPassword(password, project.password_hash)) {
      return reply.code(401).view('login.ejs', { title: 'Вход', login, error: true }, { layout: 'layouts/auth.ejs' });
    }

    logIn(reply, project.id);
    return reply.redirect('/');
  });

  app.post('/logout', async (request, reply) => {
    logOut(request, reply);
    return reply.redirect('/login');
  });
}
