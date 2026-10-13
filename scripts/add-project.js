// Создаёт проект (сайт для проверок) и его полный сценарий.
// Запуск: npm run add-project -- "<Название>" <адрес сайта>
// Пример: npm run add-project -- Hadassah https://hadassah.moscow/
import { createProject } from '../src/db/projects.js';
import { createScenario } from '../src/db/scenarios.js';

const [name, url] = process.argv.slice(2);

if (!name || !/^https?:\/\//.test(url || '')) {
  console.error('Укажите название и адрес сайта: npm run add-project -- Hadassah https://hadassah.moscow/');
  process.exit(1);
}

const projectId = createProject({ name, url });
const scenarioId = createScenario({ projectId, name: 'Полная проверка', isFull: true });

console.log(`Проект «${name}» создан, его страница: /projects/${projectId}`);
console.log(`Полный сценарий: id ${scenarioId}. Запустить проверку: npm run check -- ${scenarioId}`);
