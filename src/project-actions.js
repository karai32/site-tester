import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIA_DIR } from './config.js';
import { createProject, deleteProject, setProjectLogo } from './db/projects.js';
import { getProjectReports } from './db/reports.js';
import { createScenario } from './db/scenarios.js';

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
