// Создаёт проект (сайт для проверок).
// Запуск: npm run add-project -- "<Название>" <адрес сайта>
// Пример: npm run add-project -- Hadassah https://hadassah.moscow/
import { createProject } from '../src/db/projects.js';

const [name, url] = process.argv.slice(2);

if (!name || !/^https?:\/\//.test(url || '')) {
  console.error('Укажите название и адрес сайта: npm run add-project -- Hadassah https://hadassah.moscow/');
  process.exit(1);
}

const id = createProject({ name, url });
console.log(`Проект «${name}» создан, его страница: /projects/${id}`);
