// Сценарии проекта: список, страница сценария, создание, копия с новой редакцией
import { findProjectById } from '../db/projects.js';
import { getProjectReports } from '../db/reports.js';
import { createScenario, findScenarioById, getProjectScenarios, nextRevision, setScenarioActive } from '../db/scenarios.js';
import { authorName } from '../helpers.js';
import { listUrl, paginate, SORTS, sortFromQuery, toList, uniqueSorted } from '../lists.js';
import { PAGE_SETS } from '../runner/page-sets.js';
import {
  allTests,
  scenarioCategoryIds,
  scenarioPageSetIds,
  scenarioSummary,
  scenarioTestIds,
} from '../scenario-info.js';
import { categories as testCategories } from '../tests/index.js';

const SCENARIOS_PER_PAGE = 10;

// Данные формы сценария. Возвращает { form, errors }: что выбрано и что не так.
function readScenarioForm(body) {
  if (!body) body = {}; // запрос без формы — как пустая форма
  const testIds = toList(body.tests);
  const pageSetIds = toList(body.page_sets);

  // Берём только существующие тесты и выборки: в форму могли подставить что угодно
  const form = {
    name: String(body.name || '').trim(),
    testIds: testIds.filter((id) => allTests.some((test) => test.id === id)),
    pageSets: pageSetIds.filter((id) => PAGE_SETS.some((set) => set.id === id)),
  };

  const errors = [];
  if (!form.name) errors.push('Укажите название сценария');
  if (form.testIds.length === 0) errors.push('Выберите хотя бы один тест');
  if (form.pageSets.length === 0) errors.push('Выберите хотя бы одну выборку страниц');

  return { form, errors };
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

    // Параметры из адреса: ?status=inactive&author=...&cat=seo&sort=tests&page=2
    const showInactive = request.query.status === 'inactive';
    const author = String(request.query.author || '');
    const selectedCategories = toList(request.query.cat);
    const sort = sortFromQuery(request.query.sort);

    // Последний готовый отчёт каждого сценария — сколько страниц проверено.
    // Отчёты идут от новых к старым, поэтому первый найденный — самый свежий.
    const lastReports = {};
    for (const report of getProjectReports(project.id)) {
      if (report.status === 'done' && !lastReports[report.scenario_id]) {
        lastReports[report.scenario_id] = report;
      }
    }

    // Сценарии с цифрами для списка
    const allScenarios = [];
    for (const scenario of getProjectScenarios(project.id)) {
      const lastReport = lastReports[scenario.id];

      // «Страниц: 28/1228» — проверено последней проверкой из всех найденных на сайте.
      // В старых отчётах (до миграции 003) общего числа нет — тогда просто «28».
      let pagesCount = 0;
      let pagesText = '—';
      if (lastReport) {
        pagesCount = lastReport.pages_count;
        pagesText = String(lastReport.pages_count);
        if (lastReport.site_pages_count) pagesText += `/${lastReport.site_pages_count}`;
      }

      const categoryIds = scenarioCategoryIds(scenario);
      allScenarios.push({
        ...scenario,
        categoryIds,
        categoriesCount: categoryIds.length,
        testsCount: scenarioTestIds(scenario).length,
        pagesCount,
        pagesText,
      });
    }

    const activeScenarios = allScenarios.filter((scenario) => scenario.is_active);
    const inactiveScenarios = allScenarios.filter((scenario) => !scenario.is_active);
    const authors = uniqueSorted(allScenarios.map((scenario) => authorName(scenario.author_name)));

    let scenarios = activeScenarios;
    if (showInactive) scenarios = inactiveScenarios;

    if (author) {
      scenarios = scenarios.filter((scenario) => authorName(scenario.author_name) === author);
    }

    // Категории: оставляем сценарии, в которых есть все выбранные категории
    if (selectedCategories.length > 0) {
      scenarios = scenarios.filter((scenario) => selectedCategories.every((id) => scenario.categoryIds.includes(id)));
    }

    scenarios.sort(SORTS[sort].compare);

    // Адрес списка с текущими фильтрами и изменениями: scenariosUrl({ page: 2 })
    const currentFilters = { author, cat: selectedCategories };
    if (showInactive) currentFilters.status = 'inactive';
    if (sort !== 'new') currentFilters.sort = sort;
    const scenariosUrl = (changes) => listUrl(`/projects/${project.id}/scenarios`, { ...currentFilters, ...changes });

    return reply.view('scenarios/list.ejs', {
      title: `Сценарии — ${project.name}`,
      project,
      showInactive,
      activeCount: activeScenarios.length,
      inactiveCount: inactiveScenarios.length,
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
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const emptyForm = { name: '', testIds: [], pageSets: [] };
    return showForm(reply, project, emptyForm, null, []);
  });

  // Создание
  app.post('/projects/:id/scenarios', async (request, reply) => {
    const project = findProjectById(request.params.id);
    if (!project) return reply.callNotFound();

    const { form, errors } = readScenarioForm(request.body);
    if (errors.length > 0) return showForm(reply, project, form, null, errors);

    const scenarioId = createScenario({
      projectId: project.id,
      authorId: reply.locals.user.id,
      name: form.name,
      testIds: form.testIds,
      pageSets: form.pageSets,
    });
    return reply.redirect(`/projects/${project.id}/scenarios/${scenarioId}`);
  });

  // Страница сценария
  app.get('/projects/:id/scenarios/:sid', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();

    return reply.view('scenarios/show.ejs', {
      title: `${data.scenario.name} — ${data.project.name}`,
      project: data.project,
      scenario: data.scenario,
      summary: scenarioSummary(data.scenario),
    }, { layout: 'layouts/app.ejs' });
  });

  // Включить или выключить сценарий
  app.post('/projects/:id/scenarios/:sid/active', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();

    const makeActive = request.body && request.body.active === '1';
    setScenarioActive(data.scenario.id, makeActive);
    return reply.redirect(`/projects/${data.project.id}/scenarios/${data.scenario.id}`);
  });

  // «Скопировать и изменить»: форма с настройками сценария и номером новой редакции в названии
  app.get('/projects/:id/scenarios/:sid/copy', async (request, reply) => {
    const data = loadScenario(request);
    if (!data) return reply.callNotFound();
    const { project, scenario } = data;

    // «Полный аудит #2» → «Полный аудит #3»: старый номер убираем, ставим следующий
    const baseName = scenario.name.replace(/\s*#\d+$/, '');
    const revision = nextRevision(scenario.root_id || scenario.id);

    const form = {
      name: `${baseName} #${revision}`,
      testIds: scenarioTestIds(scenario),
      pageSets: scenarioPageSetIds(scenario),
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

    // Все редакции ссылаются на самый первый сценарий — так считается номер следующей
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
