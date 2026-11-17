import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { MEDIA_DIR } from '../config.js';
import { findProjectById } from '../db/projects.js';
import { findReportById, getProjectReports, getReportResults } from '../db/reports.js';
import { getProjectScenarios } from '../db/scenarios.js';
import { authorName, formatDateTime } from './format.js';
import { SORTS, uniqueSorted } from './lists.js';
import { projectCategories, scenarioCategoryIds } from './scenarios.js';

export function groupByCategory(results, projectId) {
  const categories = projectCategories(projectId);
  const groups = [];

  for (const result of results) {
    let group = groups.find((item) => item.id === result.category_id);

    if (!group) {
      const category = categories.find((item) => item.id === result.category_id);
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

export function loadReport(reportId) {
  const report = findReportById(reportId);
  if (!report) return null;
  return {
    report,
    project: findProjectById(report.project_id),
    categories: groupByCategory(getReportResults(report.id), report.project_id),
  };
}

const mimeTypes = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webm': 'video/webm' };
function mediaDataUrl(file) {
  try {
    const data = readFileSync(join(MEDIA_DIR, file));
    return `data:${mimeTypes[extname(file)]};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}

export function sendReportDownload(reply, data) {
  for (const category of data.categories) {
    for (const result of category.results) {
      for (const item of result.media) item.dataUrl = mediaDataUrl(item.file);
    }
  }

  reply.header('Content-Disposition', `attachment; filename="report-${data.report.id}.html"`);
  return reply.view('reports/download.ejs', { title: `Отчёт #${data.report.id}`, ...data });
}

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
