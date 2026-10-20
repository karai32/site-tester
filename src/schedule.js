// Регулярность сценария (расписание) и отложенные проверки.
// Время в расписании - московское. В Москве нет перехода на летнее время,
// поэтому московское время всегда на 3 часа больше UTC.
import { plural } from './helpers.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MOSCOW_OFFSET = 3 * HOUR;

// Варианты расписания из ТЗ - в том порядке, в каком они стоят в форме.
// hasTime - есть время запуска; number - у варианта есть число (часов, дней или число месяца).
export const SCHEDULE_TYPES = [
  { id: 'daily', title: 'Каждый день в', hasTime: true },
  { id: 'hours', title: 'Каждые', hasTime: false, number: { unit: 'часов', min: 1, max: 24, default: 6 } },
  { id: 'days', title: 'Раз в', hasTime: true, number: { unit: 'дня', min: 2, max: 365, default: 3 } },
  { id: 'weekdays', title: 'По будням в', hasTime: true },
  { id: 'weekends', title: 'По выходным в', hasTime: true },
  { id: 'monthly', title: 'Число каждого месяца', hasTime: true, number: { unit: 'число', min: 1, max: 31, default: 1 } },
  { id: 'quarterly', title: 'Ежеквартально в', hint: '1 января, апреля, июля и октября', hasTime: true },
];

export const DEFAULT_TIME = '09:00';

export function findScheduleType(id) {
  return SCHEDULE_TYPES.find((type) => type.id === id);
}

// Расписание сценария одним объектом: { type, time, number }. type = null - нерегулярный.
export function scenarioSchedule(scenario) {
  return {
    type: scenario.schedule_type,
    time: scenario.schedule_time,
    number: scenario.schedule_number,
  };
}

// Расписание словами: «Каждый день в 17:00», «Раз в 3 дня в 15:00»
export function describeSchedule(schedule) {
  const { type, time, number } = schedule;
  if (type === 'daily') return `Каждый день в ${time}`;
  if (type === 'hours') return `Каждые ${number} ${plural(number, ['час', 'часа', 'часов'])}`;
  if (type === 'days') return `Раз в ${number} ${plural(number, ['день', 'дня', 'дней'])} в ${time}`;
  if (type === 'weekdays') return `По будням в ${time}`;
  if (type === 'weekends') return `По выходным в ${time}`;
  if (type === 'monthly') return `${number} числа каждого месяца в ${time}`;
  if (type === 'quarterly') return `Ежеквартально в ${time}`;
  return 'Запускается вручную';
}

// Расписание сценария словами
export function scheduleText(scenario) {
  return describeSchedule(scenarioSchedule(scenario));
}

// --- Когда следующий запуск ---

// Подходит ли день расписанию. В day лежит московское время в UTC-полях (см. nextRunAt).
function dayMatches(schedule, day) {
  const weekDay = day.getUTCDay(); // 0 - воскресенье, 6 - суббота
  const dayNumber = Math.floor(day.getTime() / DAY); // номер дня от 1 января 1970

  if (schedule.type === 'daily') return true;
  if (schedule.type === 'days') return dayNumber % schedule.number === 0;
  if (schedule.type === 'weekdays') return weekDay >= 1 && weekDay <= 5;
  if (schedule.type === 'weekends') return weekDay === 0 || weekDay === 6;
  if (schedule.type === 'monthly') return day.getUTCDate() === schedule.number;
  if (schedule.type === 'quarterly') return day.getUTCDate() === 1 && day.getUTCMonth() % 3 === 0;
  return false;
}

// Ближайший запуск по расписанию позже момента after (оба - Date).
// «Каждые N часов» считаются от after, остальные варианты - по календарю.
export function nextRunAt(schedule, after) {
  if (schedule.type === 'hours') return new Date(after.getTime() + schedule.number * HOUR);

  const hours = Number(schedule.time.slice(0, 2));
  const minutes = Number(schedule.time.slice(3, 5));

  // Московское время кладём в UTC-поля Date: так дни и часы считаются без часовых поясов
  const moscowAfter = new Date(after.getTime() + MOSCOW_OFFSET);

  // Перебираем дни начиная с сегодняшнего. Ежеквартальный запуск найдётся максимум через 92 дня.
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.UTC(
      moscowAfter.getUTCFullYear(),
      moscowAfter.getUTCMonth(),
      moscowAfter.getUTCDate() + i,
      hours,
      minutes,
    ));
    if (day > moscowAfter && dayMatches(schedule, day)) {
      return new Date(day.getTime() - MOSCOW_OFFSET);
    }
  }
  return null;
}

// Когда первый запуск по новому расписанию - UTC-текст для базы. У нерегулярного - null.
export function firstRunText(schedule) {
  if (!schedule.type) return null;
  return toUtcText(nextRunAt(schedule, new Date()));
}

// Ближайшие запуски сценария: отложенный и несколько регулярных подряд.
// Возвращает [{ scenario, runAt, isRegular }], runAt - UTC-текст, как в базе.
export function upcomingRuns(scenario, count) {
  const runs = [];
  if (scenario.deferred_at) {
    runs.push({ scenario, runAt: scenario.deferred_at, isRegular: false });
  }
  if (scenario.schedule_type && scenario.next_run_at) {
    const schedule = scenarioSchedule(scenario);
    let runAt = parseUtcText(scenario.next_run_at);
    for (let i = 0; i < count; i++) {
      runs.push({ scenario, runAt: toUtcText(runAt), isRegular: true });
      runAt = nextRunAt(schedule, runAt);
    }
  }
  return runs;
}

// --- Даты для базы ---

// Date -> '2026-10-15 14:00:00' (UTC, как datetime('now') в SQLite)
export function toUtcText(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// '2026-10-15 14:00:00' (UTC) -> Date
export function parseUtcText(text) {
  return new Date(text.replace(' ', 'T') + 'Z');
}

// Дата и время по Москве из формы ('2026-10-15', '17:00') -> Date. Неверные значения -> null.
export function moscowToDate(dateText, timeText) {
  if (!/^\d{4}-\d\d-\d\d$/.test(dateText) || !isTime(timeText)) return null;
  const date = new Date(`${dateText}T${timeText}:00+03:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// Дата по Москве для поля <input type="date">: '2026-10-16'
export function moscowDateInput(date) {
  return new Date(date.getTime() + MOSCOW_OFFSET).toISOString().slice(0, 10);
}

// Завтрашняя дата по Москве - подставляется в форму отложенной проверки
export function tomorrowDateInput() {
  return moscowDateInput(new Date(Date.now() + DAY));
}

// --- Форма регулярности ---

// '17:00' - время; '25:00' и 'abc' - нет
function isTime(text) {
  if (!/^\d\d:\d\d$/.test(text)) return false;
  const hours = Number(text.slice(0, 2));
  const minutes = Number(text.slice(3, 5));
  return hours < 24 && minutes < 60;
}

// Проверка регулярности - общая для формы и API.
// input: { type, time, number }, type = null - нерегулярный.
// Возвращает { schedule, errors }: schedule - только нужные варианту поля,
// errors - ошибки по полям { 'schedule.time': 'текст' }, пусто - всё верно.
export function cleanSchedule(input) {
  const errors = {};
  const schedule = { type: null, time: null, number: null };
  if (!input || input.type === null || input.type === undefined || input.type === '') {
    return { schedule, errors }; // нерегулярный
  }

  const type = findScheduleType(input.type);
  if (!type) {
    errors['schedule.type'] = 'Выберите вариант расписания';
    return { schedule, errors };
  }
  schedule.type = type.id;

  if (type.hasTime) {
    schedule.time = String(input.time || '');
    if (!isTime(schedule.time)) errors['schedule.time'] = 'Укажите время запуска в формате ЧЧ:ММ';
  }

  if (type.number) {
    schedule.number = Number(input.number);
    const { min, max } = type.number;
    if (!Number.isInteger(schedule.number) || schedule.number < min || schedule.number > max) {
      errors['schedule.number'] = `Укажите число от ${min} до ${max}`;
    }
  }

  return { schedule, errors };
}

// Регулярность из полей формы (partials/schedule-form.ejs) -> { type, time, number } для cleanSchedule.
// Поля формы: regular = '1' или '0', schedule_type, и у каждого варианта свои
// time_<вариант> и number_<вариант>, например time_daily, number_hours.
export function scheduleFromForm(body) {
  if (body.regular !== '1') return { type: null, time: null, number: null };
  return {
    type: body.schedule_type || 'не выбран', // регулярная без варианта - cleanSchedule выдаст ошибку
    time: body[`time_${body.schedule_type}`],
    number: body[`number_${body.schedule_type}`],
  };
}

// Регулярность из формы, проверенная. Возвращает { schedule, errors }, errors - список текстов.
export function readScheduleForm(body) {
  const result = cleanSchedule(scheduleFromForm(body));
  return { schedule: result.schedule, errors: Object.values(result.errors) };
}
