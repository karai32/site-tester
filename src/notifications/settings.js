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

export function isEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

// Telegram ID — число, у групп со знаком минус: 123456789, -100123456
export function isTelegramId(text) {
  return /^-?\d+$/.test(text);
}

// Проверка настроек уведомлений — общая для формы и API.
// input: { events, passPercent, emails, telegramIds } — как в базе, emails и telegramIds — массивы.
// Возвращает { notifications, errors }: errors — ошибки по полям, пусто — всё верно.
export function cleanNotifications(input) {
  const notifications = defaultNotifications(null);
  const errors = {};
  if (!input) input = {};

  // Неизвестные события и способы пропускаем: у них остаётся «none»
  const events = input.events || {};
  for (const event of NOTIFICATION_EVENTS) {
    const channel = events[event.id];
    if (CHANNELS.some((item) => item.id === channel)) notifications.events[event.id] = channel;
  }

  if (input.passPercent !== undefined) notifications.passPercent = Number(input.passPercent);
  if (!Number.isInteger(notifications.passPercent) || notifications.passPercent < 0 || notifications.passPercent > 100) {
    errors['notifications.passPercent'] = 'Порог успешности — целое число от 0 до 100';
  }

  notifications.emails = uniqueTexts(input.emails);
  notifications.telegramIds = uniqueTexts(input.telegramIds);

  const wrongEmails = notifications.emails.filter((email) => !isEmail(email));
  if (wrongEmails.length > 0) errors['notifications.emails'] = `Неверная почта: ${wrongEmails.join(', ')}`;

  const wrongIds = notifications.telegramIds.filter((id) => !isTelegramId(id));
  if (wrongIds.length > 0) errors['notifications.telegramIds'] = `Telegram ID — это число, а не имя: ${wrongIds.join(', ')}`;

  // Выбран способ, но некому отправлять
  const channels = Object.values(notifications.events);
  if (channels.includes('email') && notifications.emails.length === 0) {
    errors['notifications.emails'] = 'Укажите хотя бы одну почту для уведомлений';
  }
  if (channels.includes('telegram') && notifications.telegramIds.length === 0) {
    errors['notifications.telegramIds'] = 'Укажите хотя бы один Telegram ID для уведомлений';
  }

  return { notifications, errors };
}

// Список строк без пустых и повторов. Не массив — пустой список.
function uniqueTexts(list) {
  const items = [];
  if (!Array.isArray(list)) return items;
  for (const value of list) {
    const item = String(value).trim();
    if (item && !items.includes(item)) items.push(item);
  }
  return items;
}

// Настройки из полей формы (partials/notifications-form.ejs) → объект для cleanNotifications.
// Поля: notify_<событие> = telegram, email или none; pass_percent; emails и telegram_ids — через запятую.
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

// Настройки из формы, проверенные. Возвращает { notifications, errors }, errors — список текстов.
export function readNotificationsForm(body) {
  const result = cleanNotifications(notificationsFromForm(body));
  return { notifications: result.notifications, errors: Object.values(result.errors) };
}
