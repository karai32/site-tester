// Что входит в сценарий: тесты, категории, выборки страниц.
// У полного сценария (is_full) - все тесты на всех страницах сайта.
import { PAGE_SETS } from './runner/page-sets.js';
import { categories as testCategories } from './tests/index.js';

// Все тесты сервиса одним списком
export const allTests = [];
for (const category of testCategories) {
  for (const test of category.tests) allTests.push(test);
}

// id тестов сценария
export function scenarioTestIds(scenario) {
  if (scenario.is_full) return allTests.map((test) => test.id);
  return scenario.test_ids;
}

// id категорий, в которых у сценария есть хотя бы один тест
export function scenarioCategoryIds(scenario) {
  const testIds = scenarioTestIds(scenario);
  const result = [];
  for (const category of testCategories) {
    const hasTest = category.tests.some((test) => testIds.includes(test.id));
    if (hasTest) result.push(category.id);
  }
  return result;
}

// Категории сценария, в каждой - только выбранные тесты: [{ id, title, icon, tests }]
export function scenarioCategories(scenario) {
  const testIds = scenarioTestIds(scenario);
  const result = [];
  for (const category of testCategories) {
    const tests = category.tests.filter((test) => testIds.includes(test.id));
    if (tests.length > 0) result.push({ ...category, tests });
  }
  return result;
}

// id выборок страниц сценария
export function scenarioPageSetIds(scenario) {
  if (scenario.is_full) return ['all'];
  return scenario.page_sets;
}

// Выборки страниц сценария с названиями: [{ id, title }]
export function scenarioPageSets(scenario) {
  const ids = scenarioPageSetIds(scenario);
  return PAGE_SETS.filter((set) => ids.includes(set.id));
}

// Всё о составе сценария одним объектом - для страницы сценария и окна запуска:
// { categories: [{ title, icon, tests }], pageSets: [{ id, title }], pageSetsText, testsCount }
export function scenarioSummary(scenario) {
  const pageSets = scenarioPageSets(scenario);
  const pageSetTitles = pageSets.map((set) => set.title);

  return {
    categories: scenarioCategories(scenario),
    pageSets,
    pageSetsText: pageSetTitles.join(', '), // «Верхнеуровневые страницы, Все страницы сайта»
    testsCount: scenarioTestIds(scenario).length,
  };
}
