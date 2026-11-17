import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  createSession,
  createUser,
  deleteExpiredSessions,
  deleteSession,
  findUserByApiKey,
  findUserByLogin,
  findUserBySession,
  markApiKeyUsed,
  updatePassword,
} from '../db/users.js';
import { isEmail, isTelegramId } from './notifications.js';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPassword(password, passwordHash) {
  const [salt, hash] = passwordHash.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(expected, actual);
}

function generatePassword() {
  return randomBytes(9).toString('base64url');
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

const COOKIE_NAME = 'session';
const SESSION_DAYS = 30;

export function logIn(reply, userId) {
  deleteExpiredSessions();

  const token = randomBytes(32).toString('hex');
  createSession({ tokenHash: sha256(token), userId, days: SESSION_DAYS });

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

export function getCurrentUser(request) {
  const token = request.cookies[COOKIE_NAME];
  if (!token) return undefined;
  return findUserBySession(sha256(token));
}

const API_KEY_PREFIX = '808ck_';

export function generateApiKey() {
  const key = API_KEY_PREFIX + randomBytes(32).toString('base64url');
  return { key, keyHash: sha256(key), keyStart: key.slice(0, 10) };
}

export function findApiUser(request) {
  const header = request.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return undefined;

  const key = header.slice('Bearer '.length).trim();
  const user = findUserByApiKey(sha256(key));
  if (user) markApiKeyUsed(user.api_key_id);
  return user;
}

export function cleanUser(input, isNew) {
  const user = {
    login: String(input.login || '').trim(),
    name: String(input.name || '').trim(),
    email: String(input.email || '').trim(),
    telegramId: String(input.telegramId || '').trim(),
  };

  const errors = {};
  if (isNew) {
    if (!/^[A-Za-z0-9._-]+$/.test(user.login)) errors.login = 'Логин: латинские буквы, цифры, точка, дефис и подчёркивание';
    else if (findUserByLogin(user.login)) errors.login = `Пользователь с логином «${user.login}» уже есть`;
  }
  if (!user.name) errors.name = 'Укажите имя';
  if (user.email && !isEmail(user.email)) errors.email = 'Неверная почта';
  if (user.telegramId && !isTelegramId(user.telegramId)) errors.telegramId = 'Telegram ID должен быть числом';

  return { user, errors };
}

export function createUserWithPassword(user) {
  const password = generatePassword();
  const id = createUser({ ...user, passwordHash: hashPassword(password) });
  return { id, password };
}

export function resetPassword(userId) {
  const password = generatePassword();
  updatePassword(userId, hashPassword(password));
  return password;
}
