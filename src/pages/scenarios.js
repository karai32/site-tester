import { createReport, getScenarioReports } from '../db/reports.js';
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
const SUMMARY_BATCH = 10;

const NOTICES = {
  schedule: 'Регулярность сохранена',
  notifications: 'Уведомления сохранены',
  deferred: 'Отложенная проверка запланирована',
  'deferred-cancelled': 'Отложенная проверка отменена',
};

function scenarioUrl(scenarioId, saved) {
  const url = `/scenarios/${scenarioId}`;
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

function showForm(request, reply, form, source, errors) {
  const project = request.project;
  let title = `Создание сценария - ${project.name}`;
  if (source) title = `Обновление сценария - ${project.name}`;

  if (errors.length > 0) reply.code(400);
  return reply.view('scenarios/form.ejs', {
    title,
    form,
    source,
    errors,
    categories: projectCategories(project.id),
    pageSets: PAGE_SETS,
  }, { layout: 'layouts/app.ejs' });
}

function showScenarioPage(request, reply, scenario, options) {
  if (options.scheduleErrors || options.deferredErrors || options.notificationErrors) reply.code(400);

  return reply.view('scenarios/show.ejs', {
    title: `${scenarioTitle(scenario)} - ${request.project.name}`,
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

export default async function scenarioPages(app) {
  app.get('/scenarios', async (request, reply) => {
    const project = request.project;
    const showInactive = request.query.status === 'inactive';
    const regular = String(request.query.regular || '');
    const selectedCategories = toList(request.query.cat);
    const sort = sortFromQuery(request.query.sort);

    const result = listScenarios(project.id, { inactive: showInactive, categories: selectedCategories, regular, sort });

    const currentFilters = { cat: selectedCategories, regular };
    if (showInactive) currentFilters.status = 'inactive';
    if (sort !== 'new') currentFilters.sort = sort;
    const scenariosUrl = (changes) => listUrl('/scenarios', { ...currentFilters, ...changes });

    return reply.view('scenarios/list.ejs', {
      title: `Сценарии - ${project.name}`,
      showInactive,
      activeCount: result.activeCount,
      inactiveCount: result.inactiveCount,
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

  app.get('/scenarios/new', async (request, reply) => {
    const emptyForm = {
      name: '',
      testIds: [],
      pageSets: [],
      schedule: { type: null, time: null, number: null },
      notifications: defaultNotifications(request.project),
    };
    return showForm(request, reply, emptyForm, null, []);
  });

  app.post('/scenarios', async (request, reply) => {
    const projectId = request.project.id;
    const { form, errors } = readScenarioForm(request.body, projectId);
    if (errors.length > 0) return showForm(request, reply, form, null, errors);

    return reply.redirect(scenarioUrl(saveScenario({ projectId, scenario: form })));
  });

  app.get('/scenarios/:id', async (request, reply) => {
    return showScenarioPage(request, reply, findScenarioById(request.params.id), {
      editSchedule: request.query.edit === 'schedule',
      editNotifications: request.query.edit === 'notifications',
      notice: NOTICES[request.query.saved] || '',
    });
  });

  app.get('/scenarios/:id/summary', async (request, reply) => {
    const scenarioId = Number(request.params.id);
    const reports = getScenarioReports(scenarioId);
    const offset = Number(request.query.offset) || 0;
    const batch = reports.slice(offset, offset + SUMMARY_BATCH);
    const remaining = reports.length - offset - batch.length;

    let nextUrl = null;
    if (remaining > 0) nextUrl = `/scenarios/${scenarioId}/summary?offset=${offset + SUMMARY_BATCH}`;

    const view = offset > 0 ? 'partials/scenario-summary-rows.ejs' : 'partials/scenario-summary.ejs';
    return reply.view(view, { reports: batch, remaining, nextUrl });
  });

  app.post('/scenarios/:id/checks', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario.is_active) return reply.redirect(scenarioUrl(scenario.id));

    const reportId = createReport({ projectId: scenario.project_id, scenarioId: scenario.id });
    return reply.redirect(`/reports/${reportId}`);
  });

  app.post('/scenarios/:id/active', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    setActive(scenario, Boolean(request.body) && request.body.active === '1');
    return reply.redirect(scenarioUrl(scenario.id));
  });

  app.post('/scenarios/:id/schedule', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);

    const { schedule, errors } = readScheduleForm(request.body || {});
    if (errors.length > 0) {
      return showScenarioPage(request, reply, scenario, { editSchedule: true, schedule, scheduleErrors: errors });
    }

    setScenarioSchedule(scenario.id, schedule, firstRunText(schedule));
    return reply.redirect(scenarioUrl(scenario.id, 'schedule'));
  });

  app.post('/scenarios/:id/notifications', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);

    const { notifications, errors } = readNotificationsForm(request.body || {});
    if (errors.length > 0) {
      return showScenarioPage(request, reply, scenario, { editNotifications: true, notifications, notificationErrors: errors });
    }

    setScenarioNotifications(scenario.id, notifications);
    return reply.redirect(scenarioUrl(scenario.id, 'notifications'));
  });

  app.post('/scenarios/:id/deferred', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    if (!scenario.is_active) return reply.redirect(scenarioUrl(scenario.id));

    const body = request.body || {};
    const deferredForm = { date: String(body.date || ''), time: String(body.time || '') };

    const error = planDeferredCheck(scenario, moscowToDate(deferredForm.date, deferredForm.time));
    if (error) return showScenarioPage(request, reply, scenario, { deferredForm, deferredErrors: [error] });
    return reply.redirect(scenarioUrl(scenario.id, 'deferred'));
  });

  app.post('/scenarios/:id/deferred/cancel', async (request, reply) => {
    cancelDeferredCheck(request.params.id);
    return reply.redirect(scenarioUrl(request.params.id, 'deferred-cancelled'));
  });

  app.get('/scenarios/:id/copy', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);
    const form = {
      name: revisionName(scenario),
      testIds: scenarioTestIds(scenario),
      pageSets: scenarioPageSetIds(scenario),
      schedule: scenarioSchedule(scenario),
      notifications: scenario.notifications,
    };
    return showForm(request, reply, form, scenario, []);
  });

  app.post('/scenarios/:id/copy', async (request, reply) => {
    const scenario = findScenarioById(request.params.id);

    const { form, errors } = readScenarioForm(request.body, scenario.project_id);
    if (errors.length > 0) return showForm(request, reply, form, scenario, errors);

    const scenarioId = saveScenario({ projectId: scenario.project_id, scenario: form, source: scenario });
    return reply.redirect(scenarioUrl(scenarioId));
  });
}
