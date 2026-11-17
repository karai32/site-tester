import { parseUtc, plural } from './format.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MOSCOW_OFFSET = 3 * HOUR;

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

function findScheduleType(id) {
  return SCHEDULE_TYPES.find((type) => type.id === id);
}

export function scenarioSchedule(scenario) {
  return {
    type: scenario.schedule_type,
    time: scenario.schedule_time,
    number: scenario.schedule_number,
  };
}

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

export function scheduleText(scenario) {
  return describeSchedule(scenarioSchedule(scenario));
}

function dayMatches(schedule, day) {
  const weekDay = day.getUTCDay();
  const dayNumber = Math.floor(day.getTime() / DAY);

  if (schedule.type === 'daily') return true;
  if (schedule.type === 'days') return dayNumber % schedule.number === 0;
  if (schedule.type === 'weekdays') return weekDay >= 1 && weekDay <= 5;
  if (schedule.type === 'weekends') return weekDay === 0 || weekDay === 6;
  if (schedule.type === 'monthly') return day.getUTCDate() === schedule.number;
  if (schedule.type === 'quarterly') return day.getUTCDate() === 1 && day.getUTCMonth() % 3 === 0;
  return false;
}

export function nextRunAt(schedule, after) {
  if (schedule.type === 'hours') return new Date(after.getTime() + schedule.number * HOUR);

  const hours = Number(schedule.time.slice(0, 2));
  const minutes = Number(schedule.time.slice(3, 5));

  const moscowAfter = new Date(after.getTime() + MOSCOW_OFFSET);

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

export function firstRunText(schedule) {
  if (!schedule.type) return null;
  return toUtcText(nextRunAt(schedule, new Date()));
}

export function upcomingRuns(scenario, count) {
  const runs = [];
  if (scenario.deferred_at) {
    runs.push({ scenario, runAt: scenario.deferred_at, isRegular: false });
  }
  if (scenario.schedule_type && scenario.next_run_at) {
    const schedule = scenarioSchedule(scenario);
    let runAt = parseUtc(scenario.next_run_at);
    for (let i = 0; i < count; i++) {
      runs.push({ scenario, runAt: toUtcText(runAt), isRegular: true });
      runAt = nextRunAt(schedule, runAt);
    }
  }
  return runs;
}

export function toUtcText(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function moscowToDate(dateText, timeText) {
  if (!/^\d{4}-\d\d-\d\d$/.test(dateText) || !isTime(timeText)) return null;
  const date = new Date(`${dateText}T${timeText}:00+03:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function tomorrowDateInput() {
  return new Date(Date.now() + DAY + MOSCOW_OFFSET).toISOString().slice(0, 10);
}

function isTime(text) {
  if (!/^\d\d:\d\d$/.test(text)) return false;
  const hours = Number(text.slice(0, 2));
  const minutes = Number(text.slice(3, 5));
  return hours < 24 && minutes < 60;
}

export function cleanSchedule(input) {
  const errors = {};
  const schedule = { type: null, time: null, number: null };
  if (!input || input.type === null || input.type === undefined || input.type === '') {
    return { schedule, errors };
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

export function scheduleFromForm(body) {
  if (body.regular !== '1') return { type: null, time: null, number: null };
  return {
    type: body.schedule_type || 'не выбран',
    time: body[`time_${body.schedule_type}`],
    number: body[`number_${body.schedule_type}`],
  };
}

export function readScheduleForm(body) {
  const result = cleanSchedule(scheduleFromForm(body));
  return { schedule: result.schedule, errors: Object.values(result.errors) };
}
