import { findUserByLogin } from '../db/users.js';
import { checkPassword, getCurrentUser, logIn, logOut } from '../logic/users.js';

export default async function loginPages(app) {
  app.get('/login', async (request, reply) => {
    if (getCurrentUser(request)) return reply.redirect('/');
    return reply.view('login.ejs', { title: 'Вход', login: '', error: false }, { layout: 'layouts/auth.ejs' });
  });

  app.post('/login', async (request, reply) => {
    const form = request.body || {};
    const login = String(form.login || '').trim();
    const password = String(form.password || '');

    const user = findUserByLogin(login);
    if (!user || !checkPassword(password, user.password_hash)) {
      return reply.code(401).view('login.ejs', { title: 'Вход', login, error: true }, { layout: 'layouts/auth.ejs' });
    }

    logIn(reply, user.id);
    return reply.redirect('/');
  });

  app.post('/logout', async (request, reply) => {
    logOut(request, reply);
    return reply.redirect('/login');
  });
}
