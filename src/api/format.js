// Перевод записей из базы в объекты API: имена полей в camelCase, даты в ISO 8601 (UTC).

// '2026-10-19 08:00:00' (UTC в базе) → '2026-10-19T08:00:00Z'. Пусто — null.
export function isoDate(utcText) {
  if (!utcText) return null;
  return utcText.replace(' ', 'T') + 'Z';
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
