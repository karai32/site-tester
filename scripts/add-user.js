// Создаёт пользователя. Пароль придумывается сам и показывается один раз.
// Запуск: npm run add-user -- <логин> "<Имя Фамилия>" [почта]
// Пример: npm run add-user -- artem "Артем Тепляков" artem@808group.ru
import { cleanUser, createUserWithPassword } from '../src/user-actions.js';

const [login, name, email] = process.argv.slice(2);

const { user, errors } = cleanUser({ login, name, email }, true);
if (Object.keys(errors).length > 0) {
  console.error(Object.values(errors).join('\n'));
  console.error('Пример: npm run add-user -- artem "Артем Тепляков" artem@808group.ru');
  process.exit(1);
}

const { password } = createUserWithPassword(user);
console.log(`Пользователь создан.\nЛогин:  ${user.login}\nПароль: ${password}\nСохраните пароль: больше он нигде не показывается.`);
