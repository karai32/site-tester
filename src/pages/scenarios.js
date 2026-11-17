import { findProjectById } from '../db/projects.js';
import {
  cancelDeferredCheck,
  findScenarioById,
  setScenarioNotifications,
  setScenarioSchedule,
} from '../db/scenarios.js';
import { scenarioTitle } from '../logic/format.js';
import { listUrl, paginate, sortFromQuery, SORTS, toList } from '../logic/lists.js';
import { defaultNotifications, notificationsFromForm, readNotificationsForm } from '../logic/notifications.js';
import { PAGE_SETS } from '../logic/page-sets.js';
import {
  cleanScenario,
  listScenarios,
  planDeferredCheck,
  projectCategories,
  projectTests,
  revisionName,
  saveScenario,
  scenarioPageSetIds,
  scenarioSummary,
  scenarioTestIds,
  setActive,
} from '../logic/scenarios.js';
import {
  DEFAULT_TIME,
  firstRunText,
  moscowToDate,
  readScheduleForm,
  scenarioSchedule,
  scheduleFromForm,
  tomorrowDateInput,
} from '../logic/schedule.js';

const SCENARIOS_PER_PAGE = 10;

const NOTICES = {
  schedule: 'Регулярность сохранена',
  notifications: 'Уведомления сохранены',
  deferred: 'Отложенная проверка запланирована',
  'deferred-cancelled': 'Отложенная проверка отменена',
};

function scenarioUrl(projectId, scenarioId, saved) {
  const url = `/projects/${projectId}/scenarios/${scenarioId}`;
  if (saved) return `${url}?saved=${saved}`;
  return url;
}

function readScenarioForm(body, projectId) {
  if (!body) body = {};
  const { scenario, errors } = cleanScenario({
    name: body.name,
    testIds: toList(body.tests),
    pageSets: toList(body.page_sets),
    schedule: scheduleFromForm(body),
    notifications: notificationsFromForm(body),
  }, projectId);
  return { form: scenario, errors: Object.values(errors) };
}

function showForm(reply, project, form, source, errors) {
  let title = `Создание сценария - ${project.name}`;
  if (source) title = `Обновление сценария - ${project.name}`;

  if (errors.length > 0) reply.code(400);
  return reply.view('scenarios/form.ejs', {
    title,
    project,
    form,
    source,
    errors,
    categories: projectCategories(project.id),
    pageSets: PAGE_SETS,
  }, { layout: 'layouts/app.ejs' });
}

function showScenarioPage(reply, project, scenario, options) {
  if (options.scheduleErrors || options.deferredErrors || options.notificationErrors) reply.code(400);

  return reply.view('scenarios/show.ejs', {
    title: `${scenarioTitle(scenario)} - ${project.name}`,
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

function loadScenario(request) {
  const project = findProjectById(request.params.id);
  if (!project) return null;

  const scenario = findScenarioById(request.params.sid);
  if (!scenario || scenario.project_id !== project.id) return null;

  return { project, scenario };
}

export default async function scenarioPages(app) {
  app.get('/projects/:id/scenarios', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const showInactive = request.query.status === 'inactive';
    const author = String(request.query.author || '');
    const regular = String(request.query.regular || '');
    const selectedCategories = toList(request.query.cat);
    const sort = sortFromQuery(request.query.sort);

    const result = listScenarios(project.id, {
      inactive: showInactive,
      author,
      categories: selectedCategories,
      regular,
      sort,
    });

    const currentFilters = { author, cat: selectedCategories, regular };
    if (showInactive) currentFilters.status = 'inactive';
    if (sort !== 'new') currentFilters.sort = sort;
    const scenariosUrl = (changes) => listUrl(`/projects/${project.id}/scenarios`, { ...currentFilters, ...changes });

    return reply.view('scenarios/list.ejs', {
      title: `Сценарии - ${project.name}`,
      project,
      showInactive,
      activeCount: result.activeCount,
      inactiveCount: result.inactiveCount,
      author,
      authors: result.authors,
      selectedCategories,
      categories: projectCategories(project.id),
      regular,
      sort,
      sorts: SORTS,
      totalTests: projectTests(project.id).length,
      pagination: paginate(result.scenarios, Number(request.query.page) || 1, SCENARIOS_PER_PAGE),
      scenariosUrl,
    }, { layout: 'layouts/app.ejs' });
  });

  app.get('/projects/:id/scenarios/new', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const emptyForm = {
      name: '',
      testIds: [],
      pageSets: [],
      schedule: { type: null, time: null, number: null },
      notifications: defaultNotifications(reply.locals.user),
    };
    return showForm(reply, project, emptyForm, null, []);
  });

  app.post('/projects/:id/scenarios', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const { form, errors } = readScenarioForm(request.body, project.id);
    if (errors.length > 0) return showForm(reply, project, form, null, errors);

    const scenarioId = saveScenario({ projectId: project.id, authorId: reply.locals.user.id, scenario: form });
    return reply.redirect(scenarioUrl(project.id, scenarioId));
  });

  app.get('/projects/:id/scenarios/:sid', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();

    return showScenarioPage(reply, data.project, data.scenario, {
      editSchedule: request.query.edit === 'schedule',
      editNotifications: request.query.edit === 'notifications',
      notice: NOTICES[request.query.saved] || '',
    });
  });

  app.post('/projects/:id/scenarios/:sid/active', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    const makeActive = request.body && request.body.active === '1';
    setActive(scenario, makeActive);
    return reply.redirect(scenarioUrl(project.id, scenario.id));
  });

  app.post('/projects/:id/scenarios/:sid/schedule', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    const { schedule, errors } = readScheduleForm(request.body || {});
    if (errors.length > 0) {
      return showScenarioPage(reply, project, scenario, { editSchedule: true, schedule, scheduleErrors: errors });
    }

    setScenarioSchedule(scenario.id, schedule, firstRunText(schedule));
    return reply.redirect(scenarioUrl(project.id, scenario.id, 'schedule'));
  });

  app.post('/projects/:id/scenarios/:sid/notifications', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    const { notifications, errors } = readNotificationsForm(request.body || {});
    if (errors.length > 0) {
      return showScenarioPage(reply, project, scenario, { editNotifications: true, notifications, notificationErrors: errors });
    }

    setScenarioNotifications(scenario.id, notifications);
    return reply.redirect(scenarioUrl(project.id, scenario.id, 'notifications'));
  });

  app.post('/projects/:id/scenarios/:sid/deferred', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;
    if (!scenario.is_active) return reply.redirect(scenarioUrl(project.id, scenario.id));

    const body = request.body || {};
    const deferredForm = { date: String(body.date || ''), time: String(body.time || '') };
    const runAt = moscowToDate(deferredForm.date, deferredForm.time);

    const error = planDeferredCheck(scenario, runAt, reply.locals.user.id);
    if (error) {
      return showScenarioPage(reply, project, scenario, { deferredForm, deferredErrors: [error] });
    }
    return reply.redirect(scenarioUrl(project.id, scenario.id, 'deferred'));
  });

  app.post('/projects/:id/scenarios/:sid/deferred/cancel', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();

    cancelDeferredCheck(data.scenario.id);
    return reply.redirect(scenarioUrl(data.project.id, data.scenario.id, 'deferred-cancelled'));
  });

  app.get('/projects/:id/scenarios/:sid/copy', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    const form = {
      name: revisionName(scenario),
      testIds: scenarioTestIds(scenario),
      pageSets: scenarioPageSetIds(scenario),
      schedule: scenarioSchedule(scenario),
      notifications: scenario.notifications,
    };
    return showForm(reply, project, form, scenario, []);
  });

  app.post('/projects/:id/scenarios/:sid/copy', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    const { form, errors } = readScenarioForm(request.body, project.id);
    if (errors.length > 0) return showForm(reply, project, form, scenario, errors);

    const scenarioId = saveScenario({
      projectId: project.id,
      authorId: reply.locals.user.id,
      scenario: form,
      source: scenario,
    });
    return reply.redirect(scenarioUrl(project.id, scenarioId));
  });
}
