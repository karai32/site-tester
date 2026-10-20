// API-ключи: создание и поиск владельца по ключу.
// Ключ - '808ck_' и 43 случайных символа. В базе только его sha256-хеш:
// подобрать такой ключ перебором невозможно, поэтому хватает быстрого хеша (как у сессий).
import { createHash, randomBytes } from 'node:crypto';
import { findUserByApiKey, markApiKeyUsed } from '../db/api-keys.js';

const PREFIX = '808ck_';

function hashKey(key) {
  return createHash('sha256').update(key).digest('hex');
}

// Новый ключ: сам ключ (показать один раз), хеш (в базу) и начало (для списка ключей)
export function generateApiKey() {
  const key = PREFIX + randomBytes(32).toString('base64url');
  return { key, keyHash: hashKey(key), keyStart: key.slice(0, 10) };
}

// Владелец ключа из заголовка «Authorization: Bearer <ключ>» или undefined
export function findApiUser(request) {
  const header = request.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return undefined;

  const key = header.slice('Bearer '.length).trim();
  const user = findUserByApiKey(hashKey(key));
  if (user) markApiKeyUsed(user.api_key_id);
  return user;
}
