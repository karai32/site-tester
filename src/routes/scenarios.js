// Сценарии проекта: список, страница сценария, создание, копия с новой редакцией,
// регулярность и отложенная проверка
import { findProjectById } from '../db/projects.js';
import {
  cancelDeferredCheck,
  findScenarioById,
  setScenarioNotifications,
  setScenarioSchedule,
} from '../db/scenarios.js';
import { scenarioTitle } from '../helpers.js';
import { listUrl, paginate, SORTS, sortFromQuery, toList } from '../lists.js';
import { defaultNotifications, notificationsFromForm, readNotificationsForm } from '../notifications/settings.js';
import { PAGE_SETS } from '../runner/page-sets.js';
import {
  DEFAULT_TIME,
  firstRunText,
  moscowToDate,
  readScheduleForm,
  scenarioSchedule,
  scheduleFromForm,
  tomorrowDateInput,
} from '../schedule.js';
import { cleanScenario, planDeferredCheck, revisionName, saveScenario, setActive } from '../scenario-actions.js';
import { allTests, scenarioPageSetIds, scenarioSummary, scenarioTestIds } from '../scenario-info.js';
import { listScenarios } from '../scenario-list.js';
import { categories as testCategories } from '../tests/index.js';

const SCENARIOS_PER_PAGE = 10;

// Сообщения после сохранения на странице сценария: ?saved=schedule
const NOTICES = {
  schedule: 'Регулярность сохранена',
  notifications: 'Уведомления сохранены',
  deferred: 'Отложенная проверка запланирована',
  'deferred-cancelled': 'Отложенная проверка отменена',
};

// Данные формы сценария. Возвращает { form, errors }: что выбрано и что не так (список текстов).
function readScenarioForm(body) {
  if (!body) body = {}; // запрос без формы — как пустая форма
  const { scenario, errors } = cleanScenario({
    name: body.name,
    testIds: toList(body.tests),
    pageSets: toList(body.page_sets),
    schedule: scheduleFromForm(body),
    notifications: notificationsFromForm(body),
  });
  return { form: scenario, errors: Object.values(errors) };
}

// Показать форму сценария. source — исходный сценарий, если это копия; errors — ошибки заполнения.
function showForm(reply, project, form, source, errors) {
  let title = `Создание сценария — ${project.name}`;
  if (source) title = `Обновление сценария — ${project.name}`;

  if (errors.length > 0) reply.code(400);
  return reply.view('scenarios/form.ejs', {
    title,
    project,
    form,
    source,
    errors,
    categories: testCategories,
    pageSets: PAGE_SETS,
  }, { layout: 'layouts/app.ejs' });
}

// Страница сценария. options — что отличается от обычного вида:
// форма регулярности открыта, ошибки, сообщение после сохранения.
function showScenarioPage(reply, project, scenario, options) {
  // Ошибки передаются, только когда форму прислали с ошибками
  if (options.scheduleErrors || options.deferredErrors || options.notificationErrors) reply.code(400);

  return reply.view('scenarios/show.ejs', {
    title: `${scenarioTitle(scenario)} — ${project.name}`,
    project,
    scenario,
    summary: scenarioSummary(scenario),
    notice: '',
    editSchedule: false,
    schedule: scenarioSchedule(scenario),
    scheduleErrors: [],
    deferredForm: { date: tomorrowDateInput(), time: DEFAULT_TIME },
    deferredErrors: [],
    editNotifications: false,
    notifications: scenario.notifications,
    notificationErrors: [],
    ...options,
  }, { layout: 'layouts/app.ejs' });
}

// Проект и сценарий из адреса /projects/:id/scenarios/:sid. null — если чего-то нет
// или сценарий из другого проекта.
function loadScenario(request) {
  const project = findProjectById(request.params.id);
  if (!project) return null;

  const scenario = findScenarioById(request.params.sid);
  if (!scenario || scenario.project_id !== project.id) return null;

  return { project, scenario };
}

export default async function scenarioRoutes(app) {
  // Список сценариев: активные или неактивные, фильтры, сортировка, по 10 на странице
  app.get('/projects/:id/scenarios', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    // Параметры из адреса: ?status=inactive&author=...&cat=seo&regular=yes&sort=tests&page=2
    const showInactive = request.query.status === 'inactive';
    const author = String(request.query.author || '');
    const regular = String(request.query.regular || ''); // 'yes', 'no' или '' — все
    const selectedCategories = toList(request.query.cat);
    const sort = sortFromQuery(request.query.sort);

    const result = listScenarios(project.id, {
      inactive: showInactive,
      author,
      categories: selectedCategories,
      regular,
      sort,
    });

    // Адрес списка с текущими фильтрами и изменениями: scenariosUrl({ page: 2 })
    const currentFilters = { author, cat: selectedCategories, regular };
    if (showInactive) currentFilters.status = 'inactive';
    if (sort !== 'new') currentFilters.sort = sort;
    const scenariosUrl = (changes) => listUrl(`/projects/${project.id}/scenarios`, { ...currentFilters, ...changes });

    return reply.view('scenarios/list.ejs', {
      title: `Сценарии — ${project.name}`,
      project,
      showInactive,
      activeCount: result.activeCount,
      inactiveCount: result.inactiveCount,
      author,
      authors: result.authors,
      selectedCategories,
      categories: testCategories,
      regular,
      sort,
      sorts: SORTS,
      totalTests: allTests.length,
      pagination: paginate(result.scenarios, Number(request.query.page) || 1, SCENARIOS_PER_PAGE),
      scenariosUrl,
    }, { layout: 'layouts/app.ejs' });
  });

  // Форма создания
  app.get('/projects/:id/scenarios/new', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const emptyForm = {
      name: '',
      testIds: [],
      pageSets: [],
      schedule: { type: null, time: null, number: null },
      notifications: defaultNotifications(reply.locals.user), // получатели — сам автор
    };
    return showForm(reply, project, emptyForm, null, []);
  });

  // Создание
  app.post('/projects/:id/scenarios', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const { form, errors } = readScenarioForm(request.body);
    if (errors.length > 0) return showForm(reply, project, form, null, errors);

    const scenarioId = saveScenario({ projectId: project.id, authorId: reply.locals.user.id, scenario: form });
    return reply.redirect(`/projects/${project.id}/scenarios/${scenarioId}`);
  });

  // Страница сценария. ?edit=schedule — открыта форма регулярности, ?saved=... — сообщение
  app.get('/projects/:id/scenarios/:sid', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();

    return showScenarioPage(reply, data.project, data.scenario, {
      editSchedule: request.query.edit === 'schedule',
      editNotifications: request.query.edit === 'notifications',
      notice: NOTICES[request.query.saved] || '',
    });
  });

  // Включить или выключить сценарий
  app.post('/projects/:id/scenarios/:sid/active', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    const makeActive = request.body && request.body.active === '1';
    setActive(scenario, makeActive);
    return reply.redirect(`/projects/${project.id}/scenarios/${scenario.id}`);
  });

  // Сохранить регулярность
  app.post('/projects/:id/scenarios/:sid/schedule', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    const { schedule, errors } = readScheduleForm(request.body || {});
    if (errors.length > 0) {
      return showScenarioPage(reply, project, scenario, { editSchedule: true, schedule, scheduleErrors: errors });
    }

    setScenarioSchedule(scenario.id, schedule, firstRunText(schedule));
    return reply.redirect(`/projects/${project.id}/scenarios/${scenario.id}?saved=schedule`);
  });

  // Сохранить уведомления
  app.post('/projects/:id/scenarios/:sid/notifications', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    const { notifications, errors } = readNotificationsForm(request.body || {});
    if (errors.length > 0) {
      return showScenarioPage(reply, project, scenario, { editNotifications: true, notifications, notificationErrors: errors });
    }

    setScenarioNotifications(scenario.id, notifications);
    return reply.redirect(`/projects/${project.id}/scenarios/${scenario.id}?saved=notifications`);
  });

  // Запланировать отложенную проверку. Дата и время в форме — московские.
  app.post('/projects/:id/scenarios/:sid/deferred', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;
    if (!scenario.is_active) return reply.redirect(`/projects/${project.id}/scenarios/${scenario.id}`);

    const body = request.body || {};
    const deferredForm = { date: String(body.date || ''), time: String(body.time || '') };
    const runAt = moscowToDate(deferredForm.date, deferredForm.time);

    const error = planDeferredCheck(scenario, runAt, reply.locals.user.id);
    if (error) {
      return showScenarioPage(reply, project, scenario, { deferredForm, deferredErrors: [error] });
    }
    return reply.redirect(`/projects/${project.id}/scenarios/${scenario.id}?saved=deferred`);
  });

  // Отменить отложенную проверку
  app.post('/projects/:id/scenarios/:sid/deferred/cancel', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();

    cancelDeferredCheck(data.scenario.id);
    return reply.redirect(`/projects/${data.project.id}/scenarios/${data.scenario.id}?saved=deferred-cancelled`);
  });

  // «Скопировать и изменить»: форма с настройками сценария и номером новой редакции в названии
  app.get('/projects/:id/scenarios/:sid/copy', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    const form = {
      name: revisionName(scenario), // «Полный аудит #2» → «Полный аудит #3»
      testIds: scenarioTestIds(scenario),
      pageSets: scenarioPageSetIds(scenario),
      schedule: scenarioSchedule(scenario),
      notifications: scenario.notifications,
    };
    return showForm(reply, project, form, scenario, []);
  });

  // Сохранение копии — новый сценарий-редакция. Исходный остаётся как был.
  app.post('/projects/:id/scenarios/:sid/copy', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    const { form, errors } = readScenarioForm(request.body);
    if (errors.length > 0) return showForm(reply, project, form, scenario, errors);

    const scenarioId = saveScenario({
      projectId: project.id,
      authorId: reply.locals.user.id,
      scenario: form,
      source: scenario,
    });
    return reply.redirect(`/projects/${project.id}/scenarios/${scenarioId}`);
  });
}
