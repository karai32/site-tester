export const NOTIFICATION_EVENTS = [
  { id: 'started', question: 'Получать уведомления о проверках?', title: 'Запуск проверки' },
  { id: 'done', question: 'Получать уведомления о проведённых проверках?', title: 'Проведённые проверки' },
  { id: 'critical', question: 'Получать уведомления о критических ошибках?', title: 'Критические ошибки' },
  { id: 'regular', question: 'Получать уведомления после регулярных проверок?', title: 'Регулярные проверки' },
  { id: 'repeated', question: 'Получать уведомления о повторяющихся ошибках?', title: 'Повторяющиеся ошибки' },
  { id: 'status', question: 'Получать уведомления о смене статуса теста?', title: 'Смена статуса теста' },
];

export const CHANNELS = [
  { id: 'telegram', title: 'Тг' },
  { id: 'email', title: 'Почта' },
  { id: 'none', title: 'Нет' },
];

const DEFAULT_PASS_PERCENT = 80;

export function defaultNotifications(project) {
  const events = {};
  for (const event of NOTIFICATION_EVENTS) events[event.id] = 'none';

  const emails = [];
  if (project && project.email) emails.push(project.email);
  const telegramIds = [];
  if (project && project.telegram_id) telegramIds.push(project.telegram_id);

  return { events, passPercent: DEFAULT_PASS_PERCENT, emails, telegramIds };
}

export function parseNotifications(text) {
  const saved = JSON.parse(text || '{}');
  const notifications = defaultNotifications(null);

  if (saved.events) Object.assign(notifications.events, saved.events);
  if (saved.passPercent !== undefined) notifications.passPercent = saved.passPercent;
  if (saved.emails) notifications.emails = saved.emails;
  if (saved.telegramIds) notifications.telegramIds = saved.telegramIds;
  return notifications;
}

export function enabledEvents(notifications) {
  const list = [];
  for (const event of NOTIFICATION_EVENTS) {
    const channel = notifications.events[event.id];
    if (channel !== 'none') list.push({ event, channel });
  }
  return list;
}

export function notificationsText(notifications) {
  const telegram = [];
  const email = [];
  for (const { event, channel } of enabledEvents(notifications)) {
    if (channel === 'telegram') telegram.push(event.title.toLowerCase());
    if (channel === 'email') email.push(event.title.toLowerCase());
  }

  const parts = [];
  if (telegram.length > 0) parts.push(`Telegram: ${telegram.join(', ')}`);
  if (email.length > 0) parts.push(`почта: ${email.join(', ')}`);
  if (parts.length === 0) return 'Не отправляются';
  return parts.join('; ');
}

export function isEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

export function isTelegramId(text) {
  return /^-?\d+$/.test(text);
}

export function cleanNotifications(input) {
  const notifications = defaultNotifications(null);
  const errors = {};
  if (!input) input = {};

  const events = input.events || {};
  for (const event of NOTIFICATION_EVENTS) {
    const channel = events[event.id];
    if (CHANNELS.some((item) => item.id === channel)) notifications.events[event.id] = channel;
  }

  if (input.passPercent !== undefined) notifications.passPercent = Number(input.passPercent);
  if (!Number.isInteger(notifications.passPercent) || notifications.passPercent < 0 || notifications.passPercent > 100) {
    errors['notifications.passPercent'] = 'Порог успешности: целое число от 0 до 100';
  }

  notifications.emails = uniqueTexts(input.emails);
  notifications.telegramIds = uniqueTexts(input.telegramIds);

  const wrongEmails = notifications.emails.filter((email) => !isEmail(email));
  if (wrongEmails.length > 0) errors['notifications.emails'] = `Неверная почта: ${wrongEmails.join(', ')}`;

  const wrongIds = notifications.telegramIds.filter((id) => !isTelegramId(id));
  if (wrongIds.length > 0) errors['notifications.telegramIds'] = `Telegram ID должен быть числом: ${wrongIds.join(', ')}`;

  const channels = Object.values(notifications.events);
  if (channels.includes('email') && notifications.emails.length === 0) {
    errors['notifications.emails'] = 'Укажите хотя бы одну почту для уведомлений';
  }
  if (channels.includes('telegram') && notifications.telegramIds.length === 0) {
    errors['notifications.telegramIds'] = 'Укажите хотя бы один Telegram ID для уведомлений';
  }

  return { notifications, errors };
}

function uniqueTexts(list) {
  const items = [];
  if (!Array.isArray(list)) return items;
  for (const value of list) {
    const item = String(value).trim();
    if (item && !items.includes(item)) items.push(item);
  }
  return items;
}

export function notificationsFromForm(body) {
  const events = {};
  for (const event of NOTIFICATION_EVENTS) {
    events[event.id] = body[`notify_${event.id}`];
  }
  return {
    events,
    passPercent: body.pass_percent,
    emails: String(body.emails || '').split(','),
    telegramIds: String(body.telegram_ids || '').split(','),
  };
}

export function readNotificationsForm(body) {
  const result = cleanNotifications(notificationsFromForm(body));
  return { notifications: result.notifications, errors: Object.values(result.errors) };
}
