import { generatePassword, hashPassword } from './auth/passwords.js';
import { createUser, findUserByLogin, updatePassword } from './db/users.js';
import { isEmail, isTelegramId } from './notifications/settings.js';

export function cleanUser(input, isNew) {
  const user = {
    login: String(input.login || '').trim(),
    name: String(input.name || '').trim(),
    email: String(input.email || '').trim(),
    telegramId: String(input.telegramId || '').trim(),
  };

  const errors = {};
  if (isNew) {
    if (!/^[A-Za-z0-9._-]+$/.test(user.login)) errors.login = 'Логин: латинские буквы, цифры, точка, дефис и подчёркивание';
    else if (findUserByLogin(user.login)) errors.login = `Пользователь с логином «${user.login}» уже есть`;
  }
  if (!user.name) errors.name = 'Укажите имя';
  if (user.email && !isEmail(user.email)) errors.email = 'Неверная почта';
  if (user.telegramId && !isTelegramId(user.telegramId)) errors.telegramId = 'Telegram ID должен быть числом';

  return { user, errors };
}

export function createUserWithPassword(user) {
  const password = generatePassword();
  const id = createUser({ ...user, passwordHash: hashPassword(password) });
  return { id, password };
}

export function resetPassword(userId) {
  const password = generatePassword();
  updatePassword(userId, hashPassword(password));
  return password;
}
