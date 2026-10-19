// Действия с пользователями — общие для API и команд add-user, set-password:
// проверка данных, создание с паролем, новый пароль.
import { generatePassword, hashPassword } from './auth/passwords.js';
import { createUser, findUserByLogin, updatePassword } from './db/users.js';
import { isEmail, isTelegramId } from './notifications/settings.js';

// Проверка данных пользователя. login проверяется только у нового (isNew): потом он не меняется.
// Возвращает { user: { login, name, email, telegramId }, errors: { поле: текст } }.
export function cleanUser(input, isNew) {
  const user = {
    login: String(input.login || '').trim(),
    name: String(input.name || '').trim(),
    email: String(input.email || '').trim(),
    telegramId: String(input.telegramId || '').trim(),
  };

  const errors = {};
  if (isNew) {
    if (!/^[A-Za-z0-9._-]+$/.test(user.login)) errors.login = 'Логин — латинские буквы, цифры, точка, дефис и подчёркивание';
    else if (findUserByLogin(user.login)) errors.login = `Пользователь с логином «${user.login}» уже есть`;
  }
  if (!user.name) errors.name = 'Укажите имя';
  if (user.email && !isEmail(user.email)) errors.email = 'Неверная почта';
  if (user.telegramId && !isTelegramId(user.telegramId)) errors.telegramId = 'Telegram ID — это число';

  return { user, errors };
}

// Создаёт пользователя с придуманным паролем. Возвращает { id, password } — пароль показать один раз.
export function createUserWithPassword(user) {
  const password = generatePassword();
  const id = createUser({ ...user, passwordHash: hashPassword(password) });
  return { id, password };
}

// Новый пароль пользователя. Все его входы в браузерах закрываются. Возвращает пароль — показать один раз.
export function resetPassword(userId) {
  const password = generatePassword();
  updatePassword(userId, hashPassword(password));
  return password;
}
