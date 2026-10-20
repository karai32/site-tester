// Список сценариев проекта с цифрами, фильтрами и сортировкой.
// Общий для страницы «Сценарии» (routes/scenarios.js) и API (api/scenarios.js).
import { getProjectReports } from './db/reports.js';
import { getProjectScenarios } from './db/scenarios.js';
import { authorName } from './helpers.js';
import { SORTS, uniqueSorted } from './lists.js';
import { scenarioCategoryIds, scenarioTestIds } from './scenario-info.js';

// Сценарии проекта с цифрами для списка: категории, число тестов и страниц последней проверки
function scenarioItems(projectId) {
  // Последний готовый отчёт каждого сценария - сколько страниц проверено.
  // Отчёты идут от новых к старым, поэтому первый найденный - самый свежий.
  const lastReports = {};
  for (const report of getProjectReports(projectId)) {
    if (report.status === 'done' && !lastReports[report.scenario_id]) {
      lastReports[report.scenario_id] = report;
    }
  }

  const items = [];
  for (const scenario of getProjectScenarios(projectId)) {
    const lastReport = lastReports[scenario.id];

    // «Страниц: 28/1228» - проверено последней проверкой из всех найденных на сайте.
    // В старых отчётах (до миграции 003) общего числа нет - тогда просто «28».
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

// filters: { inactive, author, categories, regular, sort } - как на странице «Сценарии»:
//   inactive - true: неактивные сценарии, false: активные
//   author - имя автора как в списке («Тест Т.», «808 Checker»), '' - все
//   categories - id категорий: сценарий должен содержать все, [] - любые
//   regular - 'yes', 'no' или '' - все
//   sort - вариант из SORTS
// Возвращает { scenarios, activeCount, inactiveCount, authors }.
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

  // Категории: оставляем сценарии, в которых есть все выбранные категории
  if (filters.categories.length > 0) {
    scenarios = scenarios.filter((scenario) => filters.categories.every((id) => scenario.categoryIds.includes(id)));
  }

  // Регулярность: у регулярного сценария есть расписание
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
