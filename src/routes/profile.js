// Профиль вошедшего пользователя: данные аккаунта и контакты для уведомлений
import { updateUserContacts } from '../db/users.js';
import { isEmail, isTelegramId } from '../notifications/settings.js';

function showProfile(reply, options) {
  if (options.errors.length > 0) reply.code(400);
  return reply.view('profile.ejs', { title: 'Профиль', ...options }, { layout: 'layouts/app.ejs' });
}

export default async function profileRoutes(app) {
  // ?saved=1 — показать «Сохранено»
  app.get('/profile', async (request, reply) => {
    const user = reply.locals.user;
    const contacts = { email: user.email || '', telegramId: user.telegram_id || '' };
    return showProfile(reply, { contacts, errors: [], saved: request.query.saved === '1' });
  });

  // Сохранить почту и Telegram ID
  app.post('/profile', async (request, reply) => {
    const body = request.body || {};
    const contacts = {
      email: String(body.email || '').trim(),
      telegramId: String(body.telegram_id || '').trim(),
    };

    const errors = [];
    if (contacts.email && !isEmail(contacts.email)) errors.push('Неверная почта');
    if (contacts.telegramId && !isTelegramId(contacts.telegramId)) {
      errors.push('Telegram ID — это число. Узнать его можно, написав боту');
    }
    if (errors.length > 0) return showProfile(reply, { contacts, errors, saved: false });

    updateUserContacts(reply.locals.user.id, contacts);
    return reply.redirect('/profile?saved=1');
  });
}
