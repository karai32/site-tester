// Пользователи: список, один, создание, изменение, новый пароль, удаление
import { deleteUser, findUserById, getUsers, updateUser } from '../db/users.js';
import { cleanUser, createUserWithPassword, resetPassword } from '../user-actions.js';
import { formatUser } from './format.js';
import { hasErrors, sendData, sendError, sendValidationErrors, valueOrCurrent } from './response.js';

export default async function usersApi(app) {
  app.get('/users', async (_request, reply) => {
    return sendData(reply, getUsers().map(formatUser));
  });

  app.get('/users/:id', async (request, reply) => {
    const user = findUserById(request.params.id);
    if (!user) return sendError(reply, 404, 'not_found', 'Пользователь не найден');
    return sendData(reply, formatUser(user));
  });

  // Новый пользователь: { login, name, email?, telegramId? }. Пароль придумывает сервис
  // и возвращает один раз - передайте его пользователю, больше его нигде не узнать.
  app.post('/users', async (request, reply) => {
    const { user, errors } = cleanUser(request.body || {}, true);
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    const { id, password } = createUserWithPassword(user);
    reply.code(201);
    return sendData(reply, { user: formatUser(findUserById(id)), password });
  });

  // Изменение: { name?, email?, telegramId? } - непереданные поля не меняются. Логин не меняется.
  app.patch('/users/:id', async (request, reply) => {
    const current = findUserById(request.params.id);
    if (!current) return sendError(reply, 404, 'not_found', 'Пользователь не найден');

    const body = request.body || {};
    const { user, errors } = cleanUser({
      name: valueOrCurrent(body, 'name', current.name),
      email: valueOrCurrent(body, 'email', current.email),
      telegramId: valueOrCurrent(body, 'telegramId', current.telegram_id),
    }, false);
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    updateUser(current.id, user);
    return sendData(reply, formatUser(findUserById(current.id)));
  });

  // Новый пароль (например, пользователь забыл старый). Возвращается один раз.
  app.post('/users/:id/password', async (request, reply) => {
    const user = findUserById(request.params.id);
    if (!user) return sendError(reply, 404, 'not_found', 'Пользователь не найден');
    return sendData(reply, { password: resetPassword(user.id) });
  });

  // Удаление. У его сценариев и отчётов автор станет пустым, его API-ключи перестанут работать.
  app.delete('/users/:id', async (request, reply) => {
    const user = findUserById(request.params.id);
    if (!user) return sendError(reply, 404, 'not_found', 'Пользователь не найден');
    if (user.id === request.apiUser.id) {
      return sendError(reply, 409, 'conflict', 'Нельзя удалить пользователя, от имени которого работает ключ');
    }

    deleteUser(user.id);
    return sendData(reply, { deleted: true });
  });
}
