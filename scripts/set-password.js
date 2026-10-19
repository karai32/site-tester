// Выдаёт пользователю новый пароль (например, если он забыл старый) и показывает его один раз.
// Пользователя выкидывает из всех сессий.
// Запуск: npm run set-password -- <логин>
import { findUserByLogin } from '../src/db/users.js';
import { resetPassword } from '../src/user-actions.js';

const login = process.argv[2];
const user = login && findUserByLogin(login);
if (!user) {
  console.error(login ? `Пользователя с логином «${login}» нет` : 'Укажите логин: npm run set-password -- artem');
  process.exit(1);
}

const password = resetPassword(user.id);

console.log(`Новый пароль для ${login}: ${password}\nСохраните пароль: больше он нигде не показывается.`);
