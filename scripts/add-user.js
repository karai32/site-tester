// Создаёт пользователя. Пароль придумывается сам и показывается один раз.
// Запуск: npm run add-user -- <логин> "<Имя Фамилия>" [почта]
// Пример: npm run add-user -- artem "Артем Тепляков" artem@808group.ru
import { generatePassword, hashPassword } from '../src/auth/passwords.js';
import { createUser, findUserByLogin } from '../src/db/users.js';

const [login, name, email] = process.argv.slice(2);

if (!login || !name) {
  console.error('Укажите логин и имя: npm run add-user -- artem "Артем Тепляков" artem@808group.ru');
  process.exit(1);
}
if (findUserByLogin(login)) {
  console.error(`Пользователь с логином «${login}» уже есть`);
  process.exit(1);
}

const password = generatePassword();
createUser({ login, name, email, passwordHash: hashPassword(password) });

console.log(`Пользователь создан.\nЛогин:  ${login}\nПароль: ${password}\nСохраните пароль: больше он нигде не показывается.`);
