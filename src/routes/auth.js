// Вход и выход
import { checkPassword } from '../auth/passwords.js';
import { getCurrentUser, logIn, logOut } from '../auth/session.js';
import { findUserByLogin } from '../db/users.js';

export default async function authRoutes(app) {
  // Страница входа
  app.get('/login', async (request, reply) => {
    if (getCurrentUser(request)) return reply.redirect('/');
    return reply.view('login.ejs', { title: 'Вход', login: '', error: false }, { layout: 'layouts/auth.ejs' });
  });

  // Форма входа отправлена
  app.post('/login', async (request, reply) => {
    const login = String(request.body?.login || '').trim();
    const password = String(request.body?.password || '');

    const user = findUserByLogin(login);
    if (!user || !checkPassword(password, user.password_hash)) {
      return reply.code(401).view('login.ejs', { title: 'Вход', login, error: true }, { layout: 'layouts/auth.ejs' });
    }

    logIn(reply, user.id);
    return reply.redirect('/');
  });

  // Выход (POST, чтобы чужая страница не могла разлогинить ссылкой)
  app.post('/logout', async (request, reply) => {
    logOut(request, reply);
    return reply.redirect('/login');
  });
}
