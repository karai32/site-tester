import { getProjectReports } from './db/reports.js';
import { getProjectScenarios } from './db/scenarios.js';
import { authorName, formatDateTime } from './helpers.js';
import { SORTS, uniqueSorted } from './lists.js';
import { scenarioCategoryIds } from './scenario-info.js';

export function listReports(projectId, filters) {
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
  const authors = uniqueSorted(allReports.map((report) => authorName(report.scenario_author_name)));

  let reports = allReports;

  if (filters.search) {
    const needle = filters.search.toLowerCase();
    reports = reports.filter((report) => {
      const text = `#${report.id} ${report.scenario_name} ${authorName(report.scenario_author_name)} ${formatDateTime(report.finished_at)}`;
      return text.toLowerCase().includes(needle);
    });
  }

  if (filters.author) {
    reports = reports.filter((report) => authorName(report.scenario_author_name) === filters.author);
  }

  if (filters.categories.length > 0) {
    reports = reports.filter((report) => filters.categories.every((id) => report.categoryIds.includes(id)));
  }

  if (filters.regular === 'yes') reports = reports.filter((report) => report.is_regular);
  if (filters.regular === 'no') reports = reports.filter((report) => !report.is_regular);

  reports.sort(SORTS[filters.sort].compare);

  return { reports, authors, total: allReports.length };
}
