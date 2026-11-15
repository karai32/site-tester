import { PAGE_SETS } from './runner/page-sets.js';
import { categories as testCategories } from './tests/index.js';

export const allTests = [];
for (const category of testCategories) {
  for (const test of category.tests) allTests.push(test);
}

export function scenarioTestIds(scenario) {
  if (scenario.is_full) return allTests.map((test) => test.id);
  return scenario.test_ids;
}

export function scenarioCategoryIds(scenario) {
  const testIds = scenarioTestIds(scenario);
  const result = [];
  for (const category of testCategories) {
    const hasTest = category.tests.some((test) => testIds.includes(test.id));
    if (hasTest) result.push(category.id);
  }
  return result;
}

export function scenarioCategories(scenario) {
  const testIds = scenarioTestIds(scenario);
  const result = [];
  for (const category of testCategories) {
    const tests = category.tests.filter((test) => testIds.includes(test.id));
    if (tests.length > 0) result.push({ ...category, tests });
  }
  return result;
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
