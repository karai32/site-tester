import { findProjectById } from '../db/projects.js';
import { getProjectReports } from '../db/reports.js';
import {
  cancelDeferredCheck,
  createScenario,
  getProjectScenarios,
  nextRevision,
  setDeferredCheck,
  setNextRunAt,
  setScenarioActive,
} from '../db/scenarios.js';
import { siteCategories } from '../tests/index.js';
import { authorName } from './format.js';
import { SORTS, toList, uniqueSorted } from './lists.js';
import { cleanNotifications } from './notifications.js';
import { PAGE_SETS } from './page-sets.js';
import { cleanSchedule, firstRunText, scenarioSchedule, toUtcText } from './schedule.js';

export function projectCategories(projectId) {
  return siteCategories(findProjectById(projectId).url);
}

export function projectTests(projectId) {
  const tests = [];
  for (const category of projectCategories(projectId)) tests.push(...category.tests);
  return tests;
}

export function scenarioTestIds(scenario) {
  if (scenario.is_full) return projectTests(scenario.project_id).map((test) => test.id);
  return scenario.test_ids;
}

export function scenarioCategories(scenario) {
  const testIds = scenarioTestIds(scenario);
  const result = [];
  for (const category of projectCategories(scenario.project_id)) {
    const tests = category.tests.filter((test) => testIds.includes(test.id));
    if (tests.length > 0) result.push({ ...category, tests });
  }
  return result;
}

export function scenarioCategoryIds(scenario) {
  return scenarioCategories(scenario).map((category) => category.id);
}

export function scenarioPageSetIds(scenario) {
  if (scenario.is_full) return ['all'];
  return scenario.page_sets;
}

export function scenarioPageSets(scenario) {
  const ids = scenarioPageSetIds(scenario);
  return PAGE_SETS.filter((set) => ids.includes(set.id));
}

export function scenarioSummary(scenario) {
  const pageSets = scenarioPageSets(scenario);
  const pageSetTitles = pageSets.map((set) => set.title);

  return {
    categories: scenarioCategories(scenario),
    pageSets,
    pageSetsText: pageSetTitles.join(', '),
    testsCount: scenarioTestIds(scenario).length,
  };
}

export function cleanScenario(input, projectId) {
  const scheduleResult = cleanSchedule(input.schedule);
  const notificationsResult = cleanNotifications(input.notifications);

  const tests = projectTests(projectId);
  const testIds = toList(input.testIds).filter((id) => tests.some((test) => test.id === id));
  const pageSets = toList(input.pageSets).filter((id) => PAGE_SETS.some((set) => set.id === id));

  const scenario = {
    name: String(input.name || '').trim(),
    testIds,
    pageSets,
    schedule: scheduleResult.schedule,
    notifications: notificationsResult.notifications,
  };

  const errors = {};
  if (!scenario.name) errors.name = 'Укажите название сценария';
  if (testIds.length === 0) errors.testIds = 'Выберите хотя бы один тест';
  if (pageSets.length === 0) errors.pageSets = 'Выберите хотя бы одну выборку страниц';
  Object.assign(errors, scheduleResult.errors, notificationsResult.errors);

  return { scenario, errors };
}

export function saveScenario({ projectId, authorId, scenario, source }) {
  let rootId = null;
  let revision = 1;
  if (source) {
    rootId = source.root_id || source.id;
    revision = nextRevision(rootId);
  }

  return createScenario({
    projectId,
    authorId,
    name: scenario.name,
    testIds: scenario.testIds,
    pageSets: scenario.pageSets,
    rootId,
    revision,
    schedule: scenario.schedule,
    nextRunAt: firstRunText(scenario.schedule),
    notifications: scenario.notifications,
  });
}

export function revisionName(source) {
  const baseName = source.name.replace(/\s*#\d+$/, '');
  return `${baseName} #${nextRevision(source.root_id || source.id)}`;
}

export function setActive(scenario, isActive) {
  setScenarioActive(scenario.id, isActive);

  if (isActive) {
    setNextRunAt(scenario.id, firstRunText(scenarioSchedule(scenario)));
  } else {
    cancelDeferredCheck(scenario.id);
  }
}

export function planDeferredCheck(scenario, runAt, userId) {
  if (!runAt) return 'Укажите дату и время проверки';
  if (runAt <= new Date()) return 'Это время уже прошло';

  setDeferredCheck(scenario.id, toUtcText(runAt), userId);
  return null;
}

function scenarioItems(projectId) {
  const lastReports = {};
  for (const report of getProjectReports(projectId)) {
    if (report.status === 'done' && !lastReports[report.scenario_id]) {
      lastReports[report.scenario_id] = report;
    }
  }

  const items = [];
  for (const scenario of getProjectScenarios(projectId)) {
    const lastReport = lastReports[scenario.id];

    let pagesCount = 0;
    let sitePagesCount = null;
    let pagesText = '-';
    if (lastReport) {
      pagesCount = lastReport.pages_count;
      sitePagesCount = lastReport.site_pages_count;
      pagesText = String(lastReport.pages_count);
      if (lastReport.site_pages_count) pagesText += `/${lastReport.site_pages_count}`;
    }

    const categoryIds = scenarioCategoryIds(scenario);
    items.push({
      ...scenario,
      categoryIds,
      categoriesCount: categoryIds.length,
      testsCount: scenarioTestIds(scenario).length,
      pagesCount,
      sitePagesCount,
      pagesText,
    });
  }
  return items;
}

export function listScenarios(projectId, filters) {
  const allScenarios = scenarioItems(projectId);
  const activeScenarios = allScenarios.filter((scenario) => scenario.is_active);
  const inactiveScenarios = allScenarios.filter((scenario) => !scenario.is_active);
  const authors = uniqueSorted(allScenarios.map((scenario) => authorName(scenario.author_name)));

  let scenarios = activeScenarios;
  if (filters.inactive) scenarios = inactiveScenarios;

  if (filters.author) {
    scenarios = scenarios.filter((scenario) => authorName(scenario.author_name) === filters.author);
  }

  if (filters.categories.length > 0) {
    scenarios = scenarios.filter((scenario) => filters.categories.every((id) => scenario.categoryIds.includes(id)));
  }

  if (filters.regular === 'yes') scenarios = scenarios.filter((scenario) => scenario.schedule_type);
  if (filters.regular === 'no') scenarios = scenarios.filter((scenario) => !scenario.schedule_type);

  scenarios.sort(SORTS[filters.sort].compare);

  return {
    scenarios,
    activeCount: activeScenarios.length,
    inactiveCount: inactiveScenarios.length,
    authors,
  };
}
