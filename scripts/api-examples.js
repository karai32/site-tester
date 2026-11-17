import { writeFileSync } from 'node:fs';

const [base, key] = process.argv.slice(2);
if (!base || !key || base.includes('audit.808-test.ru')) {
  console.error('Укажите адрес тестового сервера и ключ: node scripts/api-examples.js http://127.0.0.1:3017 808ck_...');
  process.exit(1);
}

const TEST_SITE = 'http://127.0.0.1:8099';
const REAL_SITE = 'https://hadassah.moscow';
const examples = [];

function shorten(value) {
  if (Array.isArray(value)) return value.slice(0, 1).map(shorten);
  if (value && typeof value === 'object') {
    const result = {};
    for (const [field, item] of Object.entries(value)) result[field] = shorten(item);
    return result;
  }
  if (typeof value === 'string') return value.replaceAll(TEST_SITE, REAL_SITE);
  return value;
}

function showMediaFirst(json) {
  const categories = json.data.categories;
  const index = categories.findIndex((category) => category.tests.some((test) => test.media.length > 0));
  const [category] = categories.splice(index, 1);
  category.tests.sort((a, b) => b.media.length - a.media.length);
  categories.unshift(category);
}

function responseLines(json, pick) {
  const response = shorten(json);
  if (!pick) return JSON.stringify(response, null, 2).split('\n');

  const data = {};
  for (const field of pick) data[field] = response.data[field];
  const lines = JSON.stringify({ ok: true, data }, null, 2).split('\n');
  lines[lines.length - 3] += ',';
  lines.splice(lines.length - 2, 0, '    ...');
  return lines;
}

async function call(section, title, note, method, path, body, options = {}) {
  const headers = { Authorization: `Bearer ${options.key || key}` };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (options.form) payload = options.form;

  const response = await fetch(base + path, { method, headers, body: payload });
  const json = await response.json();
  if (options.prepare) options.prepare(json);

  const request = [`${method} ${path}`];
  if (options.formText) request.push(options.formText);
  else if (body !== undefined) request.push(...JSON.stringify(body, null, 2).split('\n'));

  examples.push({ section, title, note, request, status: response.status, response: responseLines(json, options.pick) });
  return json;
}

function fileExample(section, title, note, path, answer) {
  examples.push({ section, title, note, request: [`GET ${path}`], status: 200, response: [answer] });
}

await call('Ошибки', 'Нет ключа или ключ неверный', '', 'GET', '/api/projects', undefined, { key: 'wrong-key' });
await call('Ошибки', 'Неверные данные', 'В fields указано, какое поле не так.', 'POST', '/api/projects', { name: '', url: 'hadassah.moscow' });

await call('Справочники', 'Кто владелец ключа', '', 'GET', '/api/me');
await call('Справочники', 'Справочники для форм', 'Категории и тесты всех сайтов сразу, выборки страниц, варианты расписания, события уведомлений. В примере списки сокращены.', 'GET', '/api/catalog');
await call('Справочники', 'Справочники проекта', 'То же для одного проекта: только его категории и тесты. Отсюда берутся id для сценариев. В примере списки сокращены.', 'GET', '/api/projects/1/catalog');

await call('Проекты', 'Список проектов', '', 'GET', '/api/projects');
await call('Проекты', 'Проект и данные дашборда', 'Активные сценарии, 5 ближайших проверок, последняя полная и частичная проверки, 10 последних отчётов. В примере списки сокращены.', 'GET', '/api/projects/1');
const project = await call('Проекты', 'Создать проект', 'Вместе с проектом создаётся сценарий «Полная проверка».', 'POST', '/api/projects', { name: 'Тестовый сайт', url: 'https://808.ru/' });
const projectId = project.data.id;
await call('Проекты', 'Изменить проект', 'Можно передать только то, что меняется.', 'PATCH', `/api/projects/${projectId}`, { name: 'Сайт 808' });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const form = new FormData();
form.append('logo', new Blob([png]), 'logo.png');
await call('Проекты', 'Загрузить аватарку', 'PNG, JPEG или WebP до 2 МБ.', 'POST', `/api/projects/${projectId}/logo`, undefined, { form, formText: 'multipart/form-data, поле logo: файл картинки' });

await call('Сценарии', 'Список сценариев проекта', 'Параметры: status=inactive (выключенные), author (значение из meta.authors), categories=seo,forms, regular=yes или no, sort=new, old, tests-desc, tests-asc, categories-desc, categories-asc, pages-desc, pages-asc, page, perPage.', 'GET', '/api/projects/1/scenarios?sort=old');
await call('Сценарии', 'Сценарий целиком', 'Тесты по категориям, выборки, расписание, уведомления.', 'GET', '/api/scenarios/2');
const scenario = await call('Сценарии', 'Создать сценарий', 'schedule и notifications можно не передавать.', 'POST', `/api/projects/${projectId}/scenarios`, {
  name: 'SEO главных страниц',
  testIds: ['title-present', 'h1-present'],
  pageSets: ['top'],
  schedule: { type: 'daily', time: '17:00' },
  notifications: { events: { done: 'telegram' }, passPercent: 80, emails: [], telegramIds: ['123456789'] },
});
const scenarioId = scenario.data.id;
const onlyChanged = 'В ответе сценарий целиком, в примере показаны только изменённые поля.';
await call('Сценарии', 'Скопировать и изменить (новая редакция)', `Поля те же, что при создании, все необязательные: что не передано, берётся из исходного сценария. Название по умолчанию: «Название #N». ${onlyChanged}`, 'POST', `/api/scenarios/${scenarioId}/copy`, { testIds: ['title-present'] }, { pick: ['id', 'title', 'revision', 'rootId', 'testsCount'] });
await call('Сценарии', 'Выключить или включить', `Выключенный сценарий не запускается, его отложенная проверка отменяется. ${onlyChanged}`, 'PUT', `/api/scenarios/${scenarioId}/active`, { isActive: false }, { pick: ['id', 'title', 'isActive'] });
await call('Сценарии', 'Регулярность', `type: из catalog.scheduleTypes или null (только вручную). time: московское время. number: для вариантов с числом. ${onlyChanged}`, 'PUT', `/api/scenarios/${scenarioId}/schedule`, { type: 'days', time: '15:00', number: 3 }, { pick: ['id', 'title', 'schedule'] });
await call('Сценарии', 'Уведомления', `События: started, done, critical, regular, repeated, status. Способ: telegram, email или none. ${onlyChanged}`, 'PUT', `/api/scenarios/${scenarioId}/notifications`, { events: { done: 'telegram', critical: 'email' }, passPercent: 80, emails: ['qa@808.ru'], telegramIds: ['123456789'] }, { pick: ['id', 'title', 'notifications'] });
await call('Сценарии', 'Включить сценарий', '', 'PUT', `/api/scenarios/${scenarioId}/active`, { isActive: true }, { pick: ['id', 'title', 'isActive'] });
examples.pop();
await call('Сценарии', 'Отложенная проверка', `Один запуск в указанное время (UTC). ${onlyChanged}`, 'PUT', `/api/scenarios/${scenarioId}/deferred`, { runAt: '2030-01-01T06:00:00Z' }, { pick: ['id', 'title', 'deferredAt'] });
await call('Сценарии', 'Отменить отложенную проверку', onlyChanged, 'DELETE', `/api/scenarios/${scenarioId}/deferred`, undefined, { pick: ['id', 'title', 'deferredAt'] });

const check = await call('Проверки и отчёты', 'Запустить проверку', 'Проверка встаёт в очередь. Дальше перезапрашивать отчёт, пока status не станет done.', 'POST', `/api/scenarios/${scenarioId}/checks`);
await call('Проверки и отчёты', 'Отменить проверку', '', 'POST', `/api/reports/${check.data.id}/cancel`);
await call('Проверки и отчёты', 'Отчёт', 'status: queued, running, done, error, cancelled. Прогресс: testsDone из testsTotal. В примере списки сокращены.', 'GET', '/api/reports/3', undefined, { prepare: showMediaFirst });
await call('Проверки и отчёты', 'Архив отчётов проекта', 'Параметры как у списка сценариев, плюс q (поиск).', 'GET', '/api/projects/1/reports');
await call('Проверки и отчёты', 'Отчёты сценария', 'Новые сверху.', 'GET', '/api/scenarios/2/reports');
fileExample('Проверки и отчёты', 'Скачать отчёт', '', '/api/reports/3/download', 'HTML-файл отчёта со встроенными скриншотами (report-3.html)');
fileExample('Проверки и отчёты', 'Скриншоты, видео, аватарки', 'Ссылки приходят в ответах (поля url, logoUrl). Запрашивать с тем же ключом.', '/api/media/reports/3/custom-404-page-1.jpg', 'Файл картинки или видео');

await call('Пользователи', 'Список пользователей', '', 'GET', '/api/users');
const user = await call('Пользователи', 'Создать пользователя', 'email и telegramId необязательные. Пароль показывается только в этом ответе.', 'POST', '/api/users', { login: 'maria', name: 'Мария Иванова', email: 'maria@808.ru' });
const userId = user.data.user.id;
await call('Пользователи', 'Изменить пользователя', 'Можно передать только то, что меняется. Логин не меняется.', 'PATCH', `/api/users/${userId}`, { telegramId: '123456789' });
await call('Пользователи', 'Новый пароль', 'Пользователь выходит из сервиса во всех браузерах.', 'POST', `/api/users/${userId}/password`);
await call('Пользователи', 'Удалить пользователя', 'Его API-ключи перестают работать.', 'DELETE', `/api/users/${userId}`);

await call('Проекты', 'Удалить проект', 'Удаляет проект вместе со всеми сценариями и отчётами. Отменить нельзя.', 'DELETE', `/api/projects/${projectId}`);

const SECTIONS = ['Ошибки', 'Справочники', 'Проекты', 'Сценарии', 'Проверки и отчёты', 'Пользователи'];
examples.sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section));

writeFileSync(new URL('../src/api/examples.json', import.meta.url), JSON.stringify(examples, null, 2) + '\n');
console.log(`Сохранено примеров: ${examples.length} -> src/api/examples.json`);
