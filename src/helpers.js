// Небольшие функции для шаблонов. Вызываются в шаблоне так: <%= initials(user.name) %>

// Слова строки без лишних пробелов: "  Артем  Тепляков " -> ["Артем", "Тепляков"]
function words(text) {
  return text.split(' ').filter((word) => word !== '');
}

// Первые буквы первых двух слов: "Артем Тепляков" -> "АТ", "Hadassah" -> "H"
export function initials(name) {
  const [first, second] = words(name);
  let result = first ? first[0] : '';
  if (second) result += second[0];
  return result.toUpperCase();
}

// "Артем Тепляков" -> "Артем Т."
export function shortName(name) {
  const [first, last] = words(name);
  if (!last) return first;
  return `${first} ${last[0]}.`;
}

// "https://hadassah.moscow/" -> "hadassah.moscow"
export function displayUrl(url) {
  const withoutProtocol = url.replace('https://', '').replace('http://', '');
  if (withoutProtocol.endsWith('/')) return withoutProtocol.slice(0, -1);
  return withoutProtocol;
}

// Слово в нужной форме: plural(5, ['тест', 'теста', 'тестов']) -> "тестов"
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

// '2026-10-13 18:04:22' (UTC) -> объект Date
function parseUtc(utcText) {
  return new Date(utcText.replace(' ', 'T') + 'Z');
}

// Части даты по Москве: { day: '13', month: '10', year: '2026', hour: '21', minute: '04', second: '22' }
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

// "21:04:22 13.10.2026" - формат из ТЗ
export function formatDateTime(utcText) {
  if (!utcText) return '-';
  const p = dateParts(utcText);
  return `${p.hour}:${p.minute}:${p.second} ${p.day}.${p.month}.${p.year}`;
}

// "13.10.2026, 21:04" - для сводок на дашборде (формат макета)
export function formatDateShort(utcText) {
  if (!utcText) return '-';
  const p = dateParts(utcText);
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}`;
}

// "13.10.2026"
export function formatDate(utcText) {
  if (!utcText) return '-';
  const p = dateParts(utcText);
  return `${p.day}.${p.month}.${p.year}`;
}

// Сколько шла проверка: "45 с", "8 мин 54 с", "1 ч 25 мин"
export function formatDuration(startUtc, endUtc) {
  if (!startUtc || !endUtc) return '-';

  const milliseconds = parseUtc(endUtc) - parseUtc(startUtc);
  const seconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours} ч ${minutes % 60} мин`;
  if (minutes > 0) return `${minutes} мин ${seconds % 60} с`;
  return `${seconds} с`;
}

// --- Проценты и статусы ---

// Процент успешных: percentOf(33, 50) -> 66
export function percentOf(passed, total) {
  if (!total) return 0;
  return Math.round((passed / total) * 100);
}

// Цвет по проценту успешных: всё прошло - зелёный, половина и больше - оранжевый, меньше - красный
export function percentColor(percent) {
  if (percent === 100) return 'green';
  if (percent >= 50) return 'orange';
  return 'red';
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
  if (report.status === 'cancelled') return { label: 'Отменена', color: 'grey' };
  const percent = percentOf(report.tests_passed, report.tests_total);
  return { label: `${report.tests_passed}/${report.tests_total} · ${percent}%`, color: percentColor(percent) };
}

// Кто запустил проверку или создал сценарий: у автоматических записей автора нет
export function authorName(name) {
  if (!name) return '808 Checker';
  return shortName(name);
}

// Название сценария с номером редакции (ТЗ): «Полный аудит» -> «Полный аудит #1».
// Если этот номер уже стоит в конце названия («Полный аудит #2»), второй раз не добавляется.
export function scenarioTitle(scenario) {
  const revision = `#${scenario.revision}`;
  if (scenario.name.endsWith(revision)) return scenario.name;
  return `${scenario.name} ${revision}`;
}
