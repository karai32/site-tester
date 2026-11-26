import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIA_DIR } from '../config.js';
import { createProject, deleteProject, findProjectByLogin, setProjectLogo } from '../db/projects.js';
import { findLatestDoneReport, getProjectReports, getRecentReports, getReportResults } from '../db/reports.js';
import { createScenario, getProjectScenarios } from '../db/scenarios.js';
import { newPassword } from './auth.js';
import { isEmail, isTelegramId } from './notifications.js';
import { groupByCategory } from './reports.js';
import { scenarioSummary } from './scenarios.js';
import { upcomingRuns } from './schedule.js';

export function cleanProject(input, isNew) {
  const project = {
    name: String(input.name || '').trim(),
    url: String(input.url || '').trim(),
    login: String(input.login || '').trim(),
  };

  const errors = {};
  if (!project.name) errors.name = 'Укажите название проекта';
  if (!/^https?:\/\/\S+$/.test(project.url)) errors.url = 'Адрес сайта должен начинаться с http:// или https://';
  if (isNew) {
    if (!/^[A-Za-z0-9._-]+$/.test(project.login)) errors.login = 'Логин: латинские буквы, цифры, точка, дефис и подчёркивание';
    else if (findProjectByLogin(project.login)) errors.login = `Проект с логином «${project.login}» уже есть`;
  }
  return { project, errors };
}

export function cleanContacts(input) {
  const contacts = {
    email: String(input.email || '').trim(),
    telegramId: String(input.telegramId || '').trim(),
  };

  const errors = {};
  if (contacts.email && !isEmail(contacts.email)) errors.email = 'Неверная почта';
  if (contacts.telegramId && !isTelegramId(contacts.telegramId)) errors.telegramId = 'Telegram ID должен быть числом';
  return { contacts, errors };
}

export function addProject({ name, url, login }) {
  const id = createProject({ name, url, login, passwordHash: null });
  createScenario({ projectId: id, name: 'Полная проверка', isFull: true });
  return { id, password: newPassword(id) };
}

export function removeProject(project) {
  for (const report of getProjectReports(project.id)) {
    rmSync(join(MEDIA_DIR, 'reports', String(report.id)), { recursive: true, force: true });
  }
  if (project.logo) rmSync(join(MEDIA_DIR, project.logo), { force: true });
  deleteProject(project.id);
}

function imageExtension(data) {
  if (data[0] === 0x89 && data.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (data[0] === 0xff && data[1] === 0xd8) return 'jpg';
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

async function readUploadedFile(request) {
  try {
    const file = await request.file();
    if (!file) return null;
    return await file.toBuffer();
  } catch {
    return null;
  }
}

export async function saveProjectLogo(project, request) {
  const data = await readUploadedFile(request);
  if (!data) return false;

  const extension = imageExtension(data);
  if (!extension) return false;

  const file = `projects/${project.id}-${Date.now()}.${extension}`;
  mkdirSync(join(MEDIA_DIR, 'projects'), { recursive: true });
  writeFileSync(join(MEDIA_DIR, file), data);

  if (project.logo) rmSync(join(MEDIA_DIR, project.logo), { force: true });
  setProjectLogo(project.id, file);
  return true;
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
