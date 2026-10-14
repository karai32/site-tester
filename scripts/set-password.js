// Выдаёт пользователю новый пароль (например, если он забыл старый) и показывает его один раз.
// Пользователя выкидывает из всех сессий.
// Запуск: npm run set-password -- <логин>
import { generatePassword, hashPassword } from '../src/auth/passwords.js';
import { findUserByLogin, updatePassword } from '../src/db/users.js';

const login = process.argv[2];
const user = login && findUserByLogin(login);
if (!user) {
  console.error(login ? `Пользователя с логином «${login}» нет` : 'Укажите логин: npm run set-password -- artem');
  process.exit(1);
}

const password = generatePassword();
updatePassword(user.id, hashPassword(password));

console.log(`Новый пароль для ${login}: ${password}\nСохраните пароль: больше он нигде не показывается.`);
