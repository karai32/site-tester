// Архив отчётов проекта: поиск, фильтры и сортировка.
// Общий для страницы «Архив отчётов» (routes/projects.js) и API (api/reports.js).
import { getProjectReports } from './db/reports.js';
import { getProjectScenarios } from './db/scenarios.js';
import { authorName, formatDateTime } from './helpers.js';
import { SORTS, uniqueSorted } from './lists.js';
import { scenarioCategoryIds } from './scenario-info.js';

// filters: { search, author, categories, regular, sort } — как на странице архива:
//   search — текст: ищется в номере, названии сценария, авторе и дате
//   author — автор сценария отчёта, как в списке («Тест Т.», «808 Checker»), '' — все
//   categories — id категорий: сценарий отчёта должен содержать все, [] — любые
//   regular — 'yes' (проверки по расписанию), 'no' или '' — все
//   sort — вариант из SORTS
// Возвращает { reports, authors, total } — total: сколько всего отчётов у проекта.
export function listReports(projectId, filters) {
  // Отчёты с цифрами для фильтров и сортировки: категории сценария, число тестов и страниц
  const scenarios = getProjectScenarios(projectId);
  const allReports = [];
  for (const report of getProjectReports(projectId)) {
    const scenario = scenarios.find((item) => item.id === report.scenario_id);
    const categoryIds = scenarioCategoryIds(scenario);
    allReports.push({
      ...report,
      categoryIds,
      categoriesCount: categoryIds.length,
      testsCount: report.tests_total || 0,
      pagesCount: report.pages_count || 0,
    });
  }
  // Автор — автор сценария отчёта (по ТЗ), а не тот, кто запустил проверку
  const authors = uniqueSorted(allReports.map((report) => authorName(report.scenario_author_name)));

  let reports = allReports;

  if (filters.search) {
    const needle = filters.search.toLowerCase();
    reports = reports.filter((report) => {
      // Ищем по тому же тексту, что виден в списке: номер, сценарий, автор, дата
      const text = `#${report.id} ${report.scenario_name} ${authorName(report.scenario_author_name)} ${formatDateTime(report.finished_at)}`;
      return text.toLowerCase().includes(needle);
    });
  }

  if (filters.author) {
    reports = reports.filter((report) => authorName(report.scenario_author_name) === filters.author);
  }

  // Категории: оставляем отчёты, в сценарии которых есть все выбранные категории
  if (filters.categories.length > 0) {
    reports = reports.filter((report) => filters.categories.every((id) => report.categoryIds.includes(id)));
  }

  // Регулярность: проверку поставило расписание сценария или нет
  if (filters.regular === 'yes') reports = reports.filter((report) => report.is_regular);
  if (filters.regular === 'no') reports = reports.filter((report) => !report.is_regular);

  reports.sort(SORTS[filters.sort].compare);

  return { reports, authors, total: allReports.length };
}
