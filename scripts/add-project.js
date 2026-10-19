// Создаёт проект (сайт для проверок) и его полный сценарий.
// Запуск: npm run add-project -- "<Название>" <адрес сайта>
// Пример: npm run add-project -- Hadassah https://hadassah.moscow/
import { cleanProject, createProjectWithScenario } from '../src/project-actions.js';

const [name, url] = process.argv.slice(2);

const { project, errors } = cleanProject({ name, url });
if (Object.keys(errors).length > 0) {
  console.error(Object.values(errors).join('\n'));
  console.error('Пример: npm run add-project -- Hadassah https://hadassah.moscow/');
  process.exit(1);
}

const projectId = createProjectWithScenario(project);
console.log(`Проект «${project.name}» создан, его страница: /projects/${projectId}`);
console.log('Вместе с ним создан сценарий «Полная проверка» — все тесты на всех страницах.');
