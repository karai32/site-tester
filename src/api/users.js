import { deleteUser, findUserById, getUsers, updateUser } from '../db/users.js';
import { cleanUser, createUserWithPassword, resetPassword } from '../logic/users.js';
import { formatUser, hasErrors, sendData, sendError, sendValidationErrors, valueOrCurrent } from './json.js';

export default async function usersApi(app) {
  app.get('/users', async (_request, reply) => {
    return sendData(reply, getUsers().map(formatUser));
  });

  app.get('/users/:id', async (request, reply) => {
    const user = findUserById(request.params.id);
    if (!user) return sendError(reply, 404, 'not_found', 'Пользователь не найден');
    return sendData(reply, formatUser(user));
  });

  app.post('/users', async (request, reply) => {
    const { user, errors } = cleanUser(request.body || {}, true);
    if (hasErrors(errors)) return sendValidationErrors(reply, errors);

    const { id, password } = createUserWithPassword(user);
    reply.code(201);
    return sendData(reply, { user: formatUser(findUserById(id)), password });
  });

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

  app.post('/users/:id/password', async (request, reply) => {
    const user = findUserById(request.params.id);
    if (!user) return sendError(reply, 404, 'not_found', 'Пользователь не найден');
    return sendData(reply, { password: resetPassword(user.id) });
  });

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
