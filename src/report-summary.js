// Результаты отчёта по категориям — для страницы отчёта и сводки на дашборде
import { categories as testCategories } from './tests/index.js';

// [{ id, title, shortTitle, icon, results, passedCount }] в порядке запуска тестов
export function groupByCategory(results) {
  const groups = new Map();
  for (const result of results) {
    if (!groups.has(result.category_id)) {
      const category = testCategories.find((item) => item.id === result.category_id);
      groups.set(result.category_id, {
        id: result.category_id,
        title: result.category_title,
        shortTitle: category?.shortTitle || result.category_title,
        icon: category?.icon || 'feather-folder',
        results: [],
        passedCount: 0,
      });
    }
    const group = groups.get(result.category_id);
    group.results.push(result);
    if (result.passed) group.passedCount += 1;
  }
  return [...groups.values()];
}

// id категорий, которые входят в сценарий (полный сценарий — все)
export function scenarioCategoryIds(scenario) {
  return testCategories
    .filter((category) => scenario.is_full || category.tests.some((test) => scenario.test_ids.includes(test.id)))
    .map((category) => category.id);
}
