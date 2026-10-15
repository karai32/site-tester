// Настройки уведомлений сценария: о каких событиях сообщать, каким способом и кому.
// В базе (scenarios.notifications) лежат JSON-текстом в таком виде:
// {
//   events: { started: 'none', done: 'telegram', critical: 'email', ... }, — способ для каждого события
//   passPercent: 80,              — от скольких % успешных тестов проверка считается пройденной
//   emails: ['qa@808.ru'],        — кому слать письма
//   telegramIds: ['123456789'],   — кому писать в Telegram
// }

// События из ТЗ, в порядке формы. question — вопрос в форме, title — подпись на странице сценария.
export const NOTIFICATION_EVENTS = [
  {
    id: 'started',
    question: 'Получать уведомления о проверках?',
    title: 'Запуск проверки',
    hint: 'Сообщение, когда проверка начинается',
  },
  {
    id: 'done',
    question: 'Получать уведомления о проведённых проверках?',
    title: 'Проведённые проверки',
    hint: 'Итог проверки, запущенной вручную или отложенной',
  },
  {
    id: 'critical',
    question: 'Получать уведомления о критических ошибках?',
    title: 'Критические ошибки',
    hint: 'Проверка не выполнилась: сайт недоступен, сбой сервиса',
  },
  {
    id: 'regular',
    question: 'Получать уведомления после регулярных проверок?',
    title: 'Регулярные проверки',
    hint: 'Итог проверки по расписанию',
  },
  {
    id: 'repeated',
    question: 'Получать уведомления о повторяющихся ошибках?',
    title: 'Повторяющиеся ошибки',
    hint: 'Тест провален два раза подряд',
  },
  {
    id: 'status',
    question: 'Получать уведомления о смене статуса теста?',
    title: 'Смена статуса теста',
    hint: 'С «успешно» на «провалено» и обратно',
  },
];

// Способы отправки
export const CHANNELS = [
  { id: 'telegram', title: 'Тг' },
  { id: 'email', title: 'Почта' },
  { id: 'none', title: 'Нет' },
];

const DEFAULT_PASS_PERCENT = 80;

// Настройки нового сценария: ничего не отправляется, получатели — автор сценария
export function defaultNotifications(user) {
  const events = {};
  for (const event of NOTIFICATION_EVENTS) events[event.id] = 'none';

  const emails = [];
  if (user && user.email) emails.push(user.email);
  const telegramIds = [];
  if (user && user.telegram_id) telegramIds.push(user.telegram_id);

  return { events, passPercent: DEFAULT_PASS_PERCENT, emails, telegramIds };
}

// JSON-текст из базы → настройки. Чего нет в базе (старые сценарии), берётся по умолчанию.
export function parseNotifications(text) {
  const saved = JSON.parse(text || '{}');
  const notifications = defaultNotifications(null);

  if (saved.events) Object.assign(notifications.events, saved.events);
  if (saved.passPercent !== undefined) notifications.passPercent = saved.passPercent;
  if (saved.emails) notifications.emails = saved.emails;
  if (saved.telegramIds) notifications.telegramIds = saved.telegramIds;
  return notifications;
}

// Включённые события: [{ event, channel }] — для страницы сценария и окна запуска
export function enabledEvents(notifications) {
  const list = [];
  for (const event of NOTIFICATION_EVENTS) {
    const channel = notifications.events[event.id];
    if (channel !== 'none') list.push({ event, channel });
  }
  return list;
}

// Коротко для окна запуска: «Telegram: запуск проверки, критические ошибки; почта: …»
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

// --- Форма ---

// «a@b.ru, c@d.ru» → ['a@b.ru', 'c@d.ru'] без пустых и повторов
function splitList(text) {
  const items = [];
  for (const part of String(text || '').split(',')) {
    const item = part.trim();
    if (item && !items.includes(item)) items.push(item);
  }
  return items;
}

export function isEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

// Telegram ID — число, у групп со знаком минус: 123456789, -100123456
export function isTelegramId(text) {
  return /^-?\d+$/.test(text);
}

// Настройки из формы (partials/notifications-form.ejs). Возвращает { notifications, errors }.
// Поля: notify_<событие> = telegram, email или none; pass_percent; emails и telegram_ids — через запятую.
export function readNotificationsForm(body) {
  const notifications = defaultNotifications(null);
  const errors = [];

  for (const event of NOTIFICATION_EVENTS) {
    const channel = body[`notify_${event.id}`];
    if (CHANNELS.some((item) => item.id === channel)) notifications.events[event.id] = channel;
  }

  notifications.passPercent = Number(body.pass_percent);
  if (!Number.isInteger(notifications.passPercent) || notifications.passPercent < 0 || notifications.passPercent > 100) {
    errors.push('Порог успешности — целое число от 0 до 100');
  }

  notifications.emails = splitList(body.emails);
  notifications.telegramIds = splitList(body.telegram_ids);

  const wrongEmails = notifications.emails.filter((email) => !isEmail(email));
  if (wrongEmails.length > 0) errors.push(`Неверная почта: ${wrongEmails.join(', ')}`);

  const wrongIds = notifications.telegramIds.filter((id) => !isTelegramId(id));
  if (wrongIds.length > 0) errors.push(`Telegram ID — это число, а не имя: ${wrongIds.join(', ')}`);

  // Выбран способ, но некому отправлять
  const channels = Object.values(notifications.events);
  if (channels.includes('email') && notifications.emails.length === 0) {
    errors.push('Укажите хотя бы одну почту для уведомлений');
  }
  if (channels.includes('telegram') && notifications.telegramIds.length === 0) {
    errors.push('Укажите хотя бы один Telegram ID для уведомлений');
  }

  return { notifications, errors };
}
