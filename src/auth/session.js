// Вход и выход. Браузер хранит случайный токен в cookie,
// сервер по хешу токена находит сессию в базе.
import { createHash, randomBytes } from 'node:crypto';
import { createSession, deleteExpiredSessions, deleteSession, findUserBySession } from '../db/sessions.js';

const COOKIE_NAME = 'session';
const SESSION_DAYS = 30;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function logIn(reply, userId) {
  deleteExpiredSessions();

  const token = randomBytes(32).toString('hex');
  createSession({ tokenHash: hashToken(token), userId, days: SESSION_DAYS });

  reply.setCookie(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true, // JS на странице не может прочитать cookie
    sameSite: 'lax', // cookie не отправляется с форм чужих сайтов
    secure: process.env.NODE_ENV === 'production', // только по https на сервере
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function logOut(request, reply) {
  const token = request.cookies[COOKIE_NAME];
  if (token) deleteSession(hashToken(token));
  reply.clearCookie(COOKIE_NAME, { path: '/' });
}

// Вошедший пользователь или undefined
export function getCurrentUser(request) {
  const token = request.cookies[COOKIE_NAME];
  if (!token) return undefined;
  return findUserBySession(hashToken(token));
}
