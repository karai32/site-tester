// Небольшие функции для шаблонов. Вызываются в шаблоне так: <%= initials(user.name) %>

// "Артем Тепляков" → "АТ", "Hadassah" → "H"
export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

// "Артем Тепляков" → "Артем Т."
export function shortName(name) {
  const [first, last] = name.split(/\s+/);
  return last ? `${first} ${last[0]}.` : first;
}

// "https://hadassah.moscow/" → "hadassah.moscow"
export function displayUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// Слово в нужной форме: plural(5, ['тест', 'теста', 'тестов']) → "тестов"
export function plural(count, [one, few, many]) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

// --- Даты ---
// В базе время хранится в UTC ('2026-10-13 18:04:22'), показываем по Москве

const TIME_ZONE = 'Europe/Moscow';

function dateParts(utcText) {
  const date = new Date(`${utcText.replace(' ', 'T')}Z`);
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

// "21:04:22 13.10.2026" — формат из ТЗ
export function formatDateTime(utcText) {
  if (!utcText) return '—';
  const p = dateParts(utcText);
  return `${p.hour}:${p.minute}:${p.second} ${p.day}.${p.month}.${p.year}`;
}

// "13.10.2026, 21:04" — для сводок на дашборде (формат макета)
export function formatDateShort(utcText) {
  if (!utcText) return '—';
  const p = dateParts(utcText);
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}`;
}

// "13.10.2026"
export function formatDate(utcText) {
  if (!utcText) return '—';
  const p = dateParts(utcText);
  return `${p.day}.${p.month}.${p.year}`;
}

// Сколько шла проверка: "8 мин 54 с"
export function formatDuration(startUtc, endUtc) {
  if (!startUtc || !endUtc) return '—';
  const seconds = Math.round((new Date(`${endUtc.replace(' ', 'T')}Z`) - new Date(`${startUtc.replace(' ', 'T')}Z`)) / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
  return minutes > 0 ? `${minutes} мин ${seconds % 60} с` : `${seconds} с`;
}

// --- Проценты и статусы ---

// Процент успешных: percentOf(33, 50) → 66
export function percentOf(passed, total) {
  return total > 0 ? Math.round((passed / total) * 100) : 0;
}

// Цвет по проценту успешных: всё прошло — зелёный, половина и больше — оранжевый, меньше — красный
export function percentColor(percent) {
  if (percent === 100) return 'green';
  return percent >= 50 ? 'orange' : 'red';
}

// Длина дуги кольца процента (окружность радиусом 44 в SVG 100×100)
export function ringDash(percent) {
  const length = 2 * Math.PI * 44;
  return `${(length * percent) / 100} ${length}`;
}

// Подпись и цвет статуса отчёта для бейджа custom-badge
export function reportStatus(report) {
  if (report.status === 'queued') return { label: 'В очереди', color: 'grey' };
  if (report.status === 'running') return { label: 'Выполняется', color: 'blue' };
  if (report.status === 'error') return { label: 'Ошибка', color: 'red' };
  const percent = percentOf(report.tests_passed, report.tests_total);
  return { label: `${report.tests_passed}/${report.tests_total} · ${percent}%`, color: percentColor(percent) };
}

// Кто запустил проверку или создал сценарий: у автоматических записей автора нет
export function authorName(name) {
  return name ? shortName(name) : '808 Checker';
}
