// Хеширование паролей. В базе хранится не пароль, а строка "соль:хеш".
// scrypt встроен в Node.js, отдельная библиотека не нужна.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPassword(password, passwordHash) {
  const [salt, hash] = passwordHash.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  // timingSafeEqual сравнивает за одинаковое время, чтобы по скорости ответа нельзя было подобрать пароль
  return timingSafeEqual(expected, actual);
}

// Случайный пароль из 12 символов, для новых пользователей
export function generatePassword() {
  return randomBytes(9).toString('base64url');
}
