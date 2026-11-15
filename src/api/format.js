import { percentOf, scenarioTitle } from '../helpers.js';
import { describeSchedule, scenarioSchedule } from '../schedule.js';
import { allTests, scenarioCategories, scenarioPageSets } from '../scenario-info.js';

export function isoDate(utcText) {
  if (!utcText) return null;
  return utcText.replace(' ', 'T') + 'Z';
}

export function mediaUrl(file) {
  return `/api/media/${file}`;
}

export function formatUser(user) {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    email: user.email,
    telegramId: user.telegram_id,
    createdAt: isoDate(user.created_at),
  };
}

function formatPerson(id, name) {
  if (!id) return null;
  return { id, name };
}

export function formatProject(project) {
  let logoUrl = null;
  if (project.logo) logoUrl = mediaUrl(project.logo);

  return {
    id: project.id,
    name: project.name,
    url: project.url,
    logoUrl,
    createdAt: isoDate(project.created_at),
  };
}

function formatSchedule(scenario) {
  const schedule = scenarioSchedule(scenario);
  return {
    type: schedule.type,
    time: schedule.time,
    number: schedule.number,
    text: describeSchedule(schedule),
    nextRunAt: isoDate(scenario.next_run_at),
  };
}

export function formatScenarioItem(item) {
  return {
    id: item.id,
    projectId: item.project_id,
    name: item.name,
    title: scenarioTitle(item),
    revision: item.revision,
    rootId: item.root_id,
    isFull: Boolean(item.is_full),
    isActive: Boolean(item.is_active),
    author: formatPerson(item.author_id, item.author_name),
    createdAt: isoDate(item.created_at),
    categoriesCount: item.categoriesCount,
    testsCount: item.testsCount,
    testsTotal: allTests.length,
    pagesCount: item.pagesCount,
    sitePagesCount: item.sitePagesCount,
    schedule: formatSchedule(item),
    deferredAt: isoDate(item.deferred_at),
  };
}

export function formatScenario(item) {
  const categories = [];
  for (const category of scenarioCategories(item)) {
    const tests = category.tests.map((test) => ({ id: test.id, title: test.title }));
    categories.push({ id: category.id, title: category.title, tests });
  }

  return {
    ...formatScenarioItem(item),
    categories,
    pageSets: scenarioPageSets(item),
    notifications: item.notifications,
  };
}

export function formatReport(report) {
  let percent = null;
  if (report.tests_total) percent = percentOf(report.tests_passed, report.tests_total);

  return {
    id: report.id,
    projectId: report.project_id,
    scenario: {
      id: report.scenario_id,
      name: report.scenario_name,
      isFull: Boolean(report.scenario_is_full),
      author: formatPerson(report.scenario_author_id, report.scenario_author_name),
    },
    startedBy: formatPerson(report.started_by, report.started_by_name),
    isRegular: Boolean(report.is_regular),
    status: report.status,
    error: report.error,
    note: report.note,
    pagesCount: report.pages_count,
    sitePagesCount: report.site_pages_count,
    testsTotal: report.tests_total,
    testsDone: report.tests_done,
    testsPassed: report.tests_passed,
    percent,
    createdAt: isoDate(report.created_at),
    startedAt: isoDate(report.started_at),
    finishedAt: isoDate(report.finished_at),
  };
}

function formatResult(result) {
  const media = [];
  for (const item of result.media) {
    let type = 'image';
    if (item.file.endsWith('.webm')) type = 'video';
    media.push({ url: mediaUrl(item.file), type, caption: item.caption });
  }

  return {
    testId: result.test_id,
    title: result.test_title,
    passed: Boolean(result.passed),
    comment: result.comment,
    problems: result.problems,
    pages: result.pages,
    media,
    durationMs: result.duration_ms,
  };
}

export function formatFullReport(report, categories) {
  const categoryList = [];
  for (const category of categories) {
    categoryList.push({
      id: category.id,
      title: category.title,
      passedCount: category.passedCount,
      testsCount: category.results.length,
      tests: category.results.map(formatResult),
    });
  }
  return { ...formatReport(report), categories: categoryList };
}
