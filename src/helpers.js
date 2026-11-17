function words(text) {
  return text.split(' ').filter((word) => word !== '');
}

export function initials(name) {
  const [first, second] = words(name);
  let result = first ? first[0] : '';
  if (second) result += second[0];
  return result.toUpperCase();
}

export function shortName(name) {
  const [first, last] = words(name);
  if (!last) return first;
  return `${first} ${last[0]}.`;
}

export function displayUrl(url) {
  const withoutProtocol = url.replace('https://', '').replace('http://', '');
  if (withoutProtocol.endsWith('/')) return withoutProtocol.slice(0, -1);
  return withoutProtocol;
}

export function plural(count, [one, few, many]) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

const TIME_ZONE = 'Europe/Moscow';

export function parseUtc(utcText) {
  return new Date(utcText.replace(' ', 'T') + 'Z');
}

function dateParts(utcText) {
  const format = new Intl.DateTimeFormat('ru-RU', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = {};
  for (const part of format.formatToParts(parseUtc(utcText))) {
    parts[part.type] = part.value;
  }
  return parts;
}

export function formatDateTime(utcText) {
  if (!utcText) return '-';
  const p = dateParts(utcText);
  return `${p.hour}:${p.minute}:${p.second} ${p.day}.${p.month}.${p.year}`;
}

export function formatDateShort(utcText) {
  if (!utcText) return '-';
  const p = dateParts(utcText);
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}`;
}

export function formatDate(utcText) {
  if (!utcText) return '-';
  const p = dateParts(utcText);
  return `${p.day}.${p.month}.${p.year}`;
}

export function percentOf(passed, total) {
  if (!total) return 0;
  return Math.round((passed / total) * 100);
}

export function percentColor(percent) {
  if (percent === 100) return 'green';
  if (percent >= 50) return 'orange';
  return 'red';
}

export function ringDash(percent) {
  const length = 2 * Math.PI * 44;
  return `${(length * percent) / 100} ${length}`;
}

export function reportStatus(report) {
  if (report.status === 'queued') return { label: 'В очереди', color: 'grey' };
  if (report.status === 'running') return { label: 'Выполняется', color: 'blue' };
  if (report.status === 'error') return { label: 'Ошибка', color: 'red' };
  if (report.status === 'cancelled') return { label: 'Отменена', color: 'grey' };
  const percent = percentOf(report.tests_passed, report.tests_total);
  return { label: `${report.tests_passed}/${report.tests_total} · ${percent}%`, color: percentColor(percent) };
}

export function authorName(name) {
  if (!name) return '808 Checker';
  return shortName(name);
}

export function scenarioTitle(scenario) {
  const revision = `#${scenario.revision}`;
  if (scenario.name.endsWith(revision)) return scenario.name;
  return `${scenario.name} ${revision}`;
}
