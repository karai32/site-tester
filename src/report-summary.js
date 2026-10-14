// Результаты отчёта по категориям — для страницы отчёта и сводки на дашборде
import { categories as testCategories } from './tests/index.js';

// [{ id, title, shortTitle, icon, results, passedCount }] в порядке запуска тестов
export function groupByCategory(results) {
  const groups = [];

  for (const result of results) {
    let group = groups.find((item) => item.id === result.category_id);

    // Первый тест категории — заводим для неё группу
    if (!group) {
      // Иконку и короткое название берём из списка тестов. Если категорию с тех пор
      // переименовали или удалили, остаётся название, сохранённое в отчёте.
      const category = testCategories.find((item) => item.id === result.category_id);
      group = {
        id: result.category_id,
        title: result.category_title,
        shortTitle: category ? category.shortTitle : result.category_title,
        icon: category ? category.icon : 'feather-folder',
        results: [],
        passedCount: 0,
      };
      groups.push(group);
    }

    group.results.push(result);
    if (result.passed) group.passedCount += 1;
  }

  return groups;
}
