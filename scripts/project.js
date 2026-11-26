import { findProjectByLogin, getProjects } from '../src/db/projects.js';
import { getProjectReports } from '../src/db/reports.js';
import { getProjectScenarios } from '../src/db/scenarios.js';
import { newPassword } from '../src/logic/auth.js';
import { addProject, cleanProject, removeProject } from '../src/logic/projects.js';
import { siteCategories } from '../src/tests/index.js';

const USAGE = `Команды:
  npm run project -- list
  npm run project -- add <логин> "<название>" <адрес сайта>
  npm run project -- password <логин>
  npm run project -- remove <логин> yes`;

function fail(text) {
  console.error(text);
  process.exit(1);
}

function projectByLogin(login) {
  const project = login && findProjectByLogin(login);
  if (!project) fail(login ? `Проекта с логином «${login}» нет` : USAGE);
  return project;
}

const [command, ...args] = process.argv.slice(2);

if (command === 'list') {
  for (const project of getProjects()) {
    console.log(`${project.login || '(без логина)'}\t${project.name}\t${project.url}`);
  }
} else if (command === 'add') {
  const [login, name, url] = args;
  const { project, errors } = cleanProject({ login, name, url }, true);
  if (Object.keys(errors).length > 0) fail(`${Object.values(errors).join('\n')}\n\n${USAGE}`);

  const { password } = addProject(project);
  console.log(`Проект «${project.name}» создан вместе со сценарием «Полная проверка».`);
  console.log(`Логин:  ${project.login}\nПароль: ${password}\nСохраните пароль: больше он нигде не показывается.`);
  console.log('API-ключ создаётся после входа, в настройках.');
  if (siteCategories(project.url).length === 0) {
    console.log('Тестов для этого сайта ещё нет: нужна папка в src/tests и строка в SITES в src/tests/index.js.');
  }
} else if (command === 'password') {
  const project = projectByLogin(args[0]);
  console.log(`Новый пароль для ${project.login}: ${newPassword(project.id)}\nСохраните пароль: больше он нигде не показывается.`);
} else if (command === 'remove') {
  const project = projectByLogin(args[0]);
  const reports = getProjectReports(project.id);
  if (reports.some((report) => report.status === 'queued' || report.status === 'running')) {
    fail('Сейчас идёт или ждёт очереди проверка этого проекта: отмените её или дождитесь конца');
  }

  const summary = `сценариев: ${getProjectScenarios(project.id).length}, отчётов: ${reports.length}`;
  if (args[1] !== 'yes') {
    fail(`Проект «${project.name}» будет удалён без возврата (${summary}).\nЧтобы удалить: npm run project -- remove ${project.login} yes`);
  }

  removeProject(project);
  console.log(`Проект «${project.name}» удалён (${summary}).`);
} else {
  fail(USAGE);
}
