import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIA_DIR } from '../config.js';
import { createProject, deleteProject, setProjectLogo } from '../db/projects.js';
import { findLatestDoneReport, getProjectReports, getRecentReports, getReportResults } from '../db/reports.js';
import { createScenario, getProjectScenarios } from '../db/scenarios.js';
import { groupByCategory } from './reports.js';
import { scenarioSummary } from './scenarios.js';
import { upcomingRuns } from './schedule.js';

export function cleanProject(input) {
  const project = {
    name: String(input.name || '').trim(),
    url: String(input.url || '').trim(),
  };
  const errors = {};
  if (!project.name) errors.name = 'Укажите название проекта';
  if (!/^https?:\/\/\S+$/.test(project.url)) errors.url = 'Адрес сайта должен начинаться с http:// или https://';
  return { project, errors };
}

export function createProjectWithScenario({ name, url }) {
  const projectId = createProject({ name, url });
  createScenario({ projectId, name: 'Полная проверка', isFull: true });
  return projectId;
}

function imageExtension(data) {
  if (data[0] === 0x89 && data.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (data[0] === 0xff && data[1] === 0xd8) return 'jpg';
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export function saveProjectLogo(project, data) {
  const extension = imageExtension(data);
  if (!extension) return false;

  const file = `projects/${project.id}-${Date.now()}.${extension}`;
  mkdirSync(join(MEDIA_DIR, 'projects'), { recursive: true });
  writeFileSync(join(MEDIA_DIR, file), data);

  if (project.logo) rmSync(join(MEDIA_DIR, project.logo), { force: true });
  setProjectLogo(project.id, file);
  return true;
}

export function deleteProjectWithFiles(project) {
  for (const report of getProjectReports(project.id)) {
    rmSync(join(MEDIA_DIR, 'reports', String(report.id)), { recursive: true, force: true });
  }
  if (project.logo) rmSync(join(MEDIA_DIR, project.logo), { force: true });
  deleteProject(project.id);
}

const UPCOMING_COUNT = 5;
const RECENT_COUNT = 10;

export function dashboardData(projectId) {
  const allScenarios = getProjectScenarios(projectId);
  const scenarios = [];
  for (const scenario of allScenarios) {
    if (scenario.is_active) scenarios.push({ ...scenario, summary: scenarioSummary(scenario) });
  }

  let upcoming = [];
  for (const scenario of scenarios) {
    upcoming.push(...upcomingRuns(scenario, UPCOMING_COUNT));
  }
  upcoming.sort((a, b) => a.runAt.localeCompare(b.runAt));
  upcoming = upcoming.slice(0, UPCOMING_COUNT);

  const lastFull = findLatestDoneReport(projectId, true);
  const lastPartial = findLatestDoneReport(projectId, false);

  let lastFullCategories = [];
  if (lastFull) lastFullCategories = groupByCategory(getReportResults(lastFull.id), projectId);

  return {
    allScenarios,
    scenarios,
    upcoming,
    lastFull,
    lastFullCategories,
    lastPartial,
    recentReports: getRecentReports(projectId, RECENT_COUNT),
  };
}
