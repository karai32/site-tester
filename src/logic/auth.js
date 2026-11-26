import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  createSession,
  deleteExpiredSessions,
  deleteSession,
  findProjectById,
  findProjectByKey,
  findProjectBySession,
  markProjectKeyUsed,
  setProjectKey,
  setProjectPassword,
} from '../db/projects.js';
import { findReportById } from '../db/reports.js';
import { findScenarioById } from '../db/scenarios.js';

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPassword(password, passwordHash) {
  if (!passwordHash) return false;
  const [salt, hash] = passwordHash.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(expected, actual);
}

export function newPassword(projectId) {
  const password = randomBytes(9).toString('base64url');
  setProjectPassword(projectId, hashPassword(password));
  return password;
}

const COOKIE_NAME = 'session';
const SESSION_DAYS = 30;

export function logIn(reply, projectId) {
  deleteExpiredSessions();

  const token = randomBytes(32).toString('hex');
  createSession({ tokenHash: sha256(token), projectId, days: SESSION_DAYS });

  reply.setCookie(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function logOut(request, reply) {
  const token = request.cookies[COOKIE_NAME];
  if (token) deleteSession(sha256(token));
  reply.clearCookie(COOKIE_NAME, { path: '/' });
}

export function sessionProject(request) {
  const token = request.cookies[COOKIE_NAME];
  if (!token) return undefined;
  return findProjectBySession(sha256(token));
}

const API_KEY_PREFIX = '808ck_';

export function newApiKey(projectId) {
  const key = API_KEY_PREFIX + randomBytes(32).toString('base64url');
  setProjectKey(projectId, { keyHash: sha256(key), keyStart: key.slice(0, 10) });
  return key;
}

export function keyProject(request) {
  const header = request.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return undefined;

  const project = findProjectByKey(sha256(header.slice('Bearer '.length).trim()));
  if (project) markProjectKeyUsed(project.id);
  return project;
}

function isOwnMedia(file, projectId) {
  const [folder, reportId] = file.split('/');
  if (folder === 'reports') return findReportById(reportId)?.project_id === projectId;
  return file === findProjectById(projectId).logo;
}

export function isOwnRoute(request, projectId) {
  const route = request.routeOptions.url || '';
  if (route.includes('/scenarios/:id')) return findScenarioById(request.params.id)?.project_id === projectId;
  if (route.includes('/reports/:id')) return findReportById(request.params.id)?.project_id === projectId;
  if (route.includes('/media/*')) return isOwnMedia(request.params['*'], projectId);
  return !('id' in request.params);
}
