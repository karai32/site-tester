// Сценарии проекта: список, страница сценария, создание, копия с новой редакцией
import { findProjectById } from '../db/projects.js';
import { getProjectReports } from '../db/reports.js';
import { createScenario, findScenarioById, getProjectScenarios, nextRevision, setScenarioActive } from '../db/scenarios.js';
import { authorName } from '../helpers.js';
import { listUrl, paginate } from '../pagination.js';
import { scenarioCategoryIds } from '../report-summary.js';
import { PAGE_SETS } from '../runner/page-sets.js';
import { categories as testCategories } from '../tests/index.js';

const SCENARIOS_PER_PAGE = 10;
const allTests = testCategories.flatMap((category) => category.tests);

// Сортировка списка: id → подпись и порядок
const SORTS = {
  new: { title: 'По дате: сначала новые', compare: (a, b) => b.id - a.id },
  old: { title: 'По дате: сначала старые', compare: (a, b) => a.id - b.id },
  tests: { title: 'По числу тестов', compare: (a, b) => b.testsCount - a.testsCount },
  categories: { title: 'По числу категорий', compare: (a, b) => b.categoryIds.length - a.categoryIds.length },
  pages: { title: 'По числу страниц', compare: (a, b) => (b.lastReport?.pages_count || 0) - (a.lastReport?.pages_count || 0) },
};

// id тестов сценария (у полного — все тесты)
function scenarioTestIds(scenario) {
  return scenario.is_full ? allTests.map((test) => test.id) : scenario.test_ids;
}

// Значения из формы: одна галочка приходит строкой, несколько — массивом
function formList(value) {
  return [value || []].flat().map(String);
}

// Проверяет и собирает данные формы сценария. Возвращает { form, errors }.
function readScenarioForm(body) {
  const form = {
    name: String(body?.name || '').trim(),
    testIds: formList(body?.tests).filter((id) => allTests.some((test) => test.id === id)),
    pageSets: formList(body?.page_sets).filter((id) => PAGE_SETS.some((set) => set.id === id)),
  };
  const errors = [];
  if (!form.name) errors.push('Укажите название сценария');
  if (form.testIds.length === 0) errors.push('Выберите хотя бы один тест');
  if (form.pageSets.length === 0) errors.push('Выберите хотя бы одну выборку страниц');
  return { form, errors };
}

// Данные для шаблона формы (создание и копия)
function formView(project, form, { errors = [], source = null }) {
  return {
    title: source ? `Обновление сценария — ${project.name}` : `Создание сценария — ${project.name}`,
    project,
    form,
    errors,
    source,
    categories: testCategories,
    pageSets: PAGE_SETS,
  };
}

export default async function scenarioRoutes(app) {
  // Проект и сценарий из адреса. Сценарий должен принадлежать проекту.
  function load(request) {
    const project = findProjectById(request.params.id);
    const scenario = request.params.sid ? findScenarioById(request.params.sid) : null;
    if (!project || (request.params.sid && scenario?.project_id !== project.id)) return null;
    return { project, scenario };
  }

  // Список сценариев: активные или неактивные, фильтры, сортировка, по 10 на странице
  app.get('/projects/:id/scenarios', async (request, reply) => {
    const data = load(request);
    if (!data) return reply.callNotFound();
    const { project } = data;

    const showInactive = request.query.status === 'inactive';
    const author = String(request.query.author || '');
    const selectedCategories = formList(request.query.cat);
    const sort = SORTS[request.query.sort] ? request.query.sort : 'new';

    // Последний готовый отчёт каждого сценария — для числа проверенных страниц
    const lastReports = new Map();
    for (const report of getProjectReports(project.id)) {
      if (report.status === 'done' && !lastReports.has(report.scenario_id)) lastReports.set(report.scenario_id, report);
    }

    const allScenarios = getProjectScenarios(project.id).map((scenario) => ({
      ...scenario,
      categoryIds: scenarioCategoryIds(scenario),
      testsCount: scenarioTestIds(scenario).length,
      lastReport: lastReports.get(scenario.id),
    }));
    const authors = [...new Set(allScenarios.map((scenario) => authorName(scenario.author_name)))].sort();

    let scenarios = allScenarios.filter((scenario) => Boolean(scenario.is_active) !== showInactive);
    const activeCount = allScenarios.filter((scenario) => scenario.is_active).length;
    if (author) scenarios = scenarios.filter((scenario) => authorName(scenario.author_name) === author);
    if (selectedCategories.length > 0) {
      scenarios = scenarios.filter((scenario) => selectedCategories.every((id) => scenario.categoryIds.includes(id)));
    }
    scenarios.sort(SORTS[sort].compare);

    const current = { status: showInactive ? 'inactive' : '', author, cat: selectedCategories, sort: sort === 'new' ? '' : sort };
    const scenariosUrl = (changes) => listUrl(`/projects/${project.id}/scenarios`, { ...current, ...changes });

    return reply.view('scenarios/list.ejs', {
      title: `Сценарии — ${project.name}`,
      project,
      showInactive,
      activeCount,
      inactiveCount: allScenarios.length - activeCount,
      author,
      authors,
      selectedCategories,
      categories: testCategories,
      sort,
      sorts: SORTS,
      totalTests: allTests.length,
      pagination: paginate(scenarios, Number(request.query.page) || 1, SCENARIOS_PER_PAGE),
      scenariosUrl,
    }, { layout: 'layouts/app.ejs' });
  });

  // Форма создания
  app.get('/projects/:id/scenarios/new', async (request, reply) => {
    const data = load(request);
    if (!data) return reply.callNotFound();
    const form = { name: '', testIds: [], pageSets: [] };
    return reply.view('scenarios/form.ejs', formView(data.project, form, {}), { layout: 'layouts/app.ejs' });
  });

  // Создание
  app.post('/projects/:id/scenarios', async (request, reply) => {
    const data = load(request);
    if (!data) return reply.callNotFound();
    const { form, errors } = readScenarioForm(request.body);
    if (errors.length > 0) {
      return reply.code(400).view('scenarios/form.ejs', formView(data.project, form, { errors }), { layout: 'layouts/app.ejs' });
    }

    const scenarioId = createScenario({
      projectId: data.project.id,
      authorId: reply.locals.user.id,
      name: form.name,
      testIds: form.testIds,
      pageSets: form.pageSets,
    });
    return reply.redirect(`/projects/${data.project.id}/scenarios/${scenarioId}`);
  });

  // Страница сценария
  app.get('/projects/:id/scenarios/:sid', async (request, reply) => {
    const data = load(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    const testIds = scenarioTestIds(scenario);
    const categories = testCategories
      .map((category) => ({ ...category, tests: category.tests.filter((test) => testIds.includes(test.id)) }))
      .filter((category) => category.tests.length > 0);
    const pageSets = PAGE_SETS.filter((set) => (scenario.is_full ? set.id === 'all' : scenario.page_sets.includes(set.id)));

    return reply.view('scenarios/show.ejs', {
      title: `${scenario.name} — ${project.name}`,
      project,
      scenario,
      categories,
      pageSets,
    }, { layout: 'layouts/app.ejs' });
  });

  // Включить или выключить сценарий
  app.post('/projects/:id/scenarios/:sid/active', async (request, reply) => {
    const data = load(request);
    if (!data) return reply.callNotFound();
    setScenarioActive(data.scenario.id, request.body?.active === '1');
    return reply.redirect(`/projects/${data.project.id}/scenarios/${data.scenario.id}`);
  });

  // «Скопировать и изменить»: форма, заполненная настройками сценария, с номером новой редакции в названии
  app.get('/projects/:id/scenarios/:sid/copy', async (request, reply) => {
    const data = load(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    const revision = nextRevision(scenario.root_id || scenario.id);
    const baseName = scenario.name.replace(/\s*#\d+$/, '');
    const form = {
      name: `${baseName} #${revision}`,
      testIds: scenarioTestIds(scenario),
      pageSets: scenario.is_full ? ['all'] : scenario.page_sets,
    };
    return reply.view('scenarios/form.ejs', formView(project, form, { source: scenario }), { layout: 'layouts/app.ejs' });
  });

  // Сохранение копии — новый сценарий-редакция; исходный остаётся как был
  app.post('/projects/:id/scenarios/:sid/copy', async (request, reply) => {
    const data = load(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;
    const { form, errors } = readScenarioForm(request.body);
    if (errors.length > 0) {
      return reply.code(400).view('scenarios/form.ejs', formView(project, form, { errors, source: scenario }), { layout: 'layouts/app.ejs' });
    }

    const rootId = scenario.root_id || scenario.id;
    const scenarioId = createScenario({
      projectId: project.id,
      authorId: reply.locals.user.id,
      name: form.name,
      testIds: form.testIds,
      pageSets: form.pageSets,
      rootId,
      revision: nextRevision(rootId),
    });
    return reply.redirect(`/projects/${project.id}/scenarios/${scenarioId}`);
  });
}
