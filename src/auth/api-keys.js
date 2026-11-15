import { createHash, randomBytes } from 'node:crypto';
import { findUserByApiKey, markApiKeyUsed } from '../db/api-keys.js';

const PREFIX = '808ck_';

function hashKey(key) {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey() {
  const key = PREFIX + randomBytes(32).toString('base64url');
  return { key, keyHash: hashKey(key), keyStart: key.slice(0, 10) };
}

export function findApiUser(request) {
  const header = request.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return undefined;

  const key = header.slice('Bearer '.length).trim();
  const user = findUserByApiKey(hashKey(key));
  if (user) markApiKeyUsed(user.api_key_id);
  return user;
}
