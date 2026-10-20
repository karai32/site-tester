// Списки на страницах (архив отчётов, сценарии): разбивка на страницы, адреса с фильтрами,
// значения галочек из формы.

// Разбивка списка на страницы.
// paginate(reports, 2, 10) -> { items: отчёты 11-20, page: 2, pagesCount, total, from: 11, to: 20, numbers }
// numbers - номера страниц для кнопок, '...' - пропуск: [1, '...', 4, 5, 6, '...', 12]
export function paginate(list, page, perPage) {
  const pagesCount = Math.max(1, Math.ceil(list.length / perPage));

  // Номер страницы из адреса может быть любым - держим его в пределах 1...pagesCount
  let current = page;
  if (current < 1) current = 1;
  if (current > pagesCount) current = pagesCount;

  const start = (current - 1) * perPage;
  const end = Math.min(start + perPage, list.length);

  return {
    items: list.slice(start, end),
    page: current,
    pagesCount,
    total: list.length,
    from: list.length === 0 ? 0 : start + 1,
    to: end,
    numbers: pageNumbers(current, pagesCount),
  };
}

// Номера страниц для кнопок: все, если страниц до 7, иначе первая, последняя и соседние с текущей
function pageNumbers(page, pagesCount) {
  const numbers = [];

  if (pagesCount <= 7) {
    for (let number = 1; number <= pagesCount; number += 1) numbers.push(number);
    return numbers;
  }

  numbers.push(1);
  if (page > 3) numbers.push('...');

  const from = Math.max(2, page - 1);
  const to = Math.min(pagesCount - 1, page + 1);
  for (let number = from; number <= to; number += 1) numbers.push(number);

  if (page < pagesCount - 2) numbers.push('...');
  numbers.push(pagesCount);
  return numbers;
}

// Адрес списка с параметрами фильтров: listUrl('/projects/1/reports', { q: 'аудит', cat: ['seo'], page: 2 })
// -> '/projects/1/reports?q=аудит&cat=seo&page=2'. Пустые значения в адрес не попадают.
export function listUrl(path, params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of toList(value)) {
      if (item) query.append(key, item);
    }
  }

  const text = query.toString();
  if (!text) return path;
  return `${path}?${text}`;
}

// Галочки из формы или адреса приходят по-разному: ни одной - undefined,
// одна - строка, несколько - массив. Приводим всегда к массиву.
export function toList(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  return [value];
}

// Список без повторов, по алфавиту: ['Тест Т.', '808 Checker', 'Тест Т.'] -> ['808 Checker', 'Тест Т.']
export function uniqueSorted(values) {
  const result = [];
  for (const value of values) {
    if (!result.includes(value)) result.push(value);
  }
  return result.sort();
}

// Сортировка списков по ТЗ: по дате, числу тестов, категорий и страниц - в обе стороны.
// Элементы списка (отчёты, сценарии) должны иметь поля id, testsCount, categoriesCount, pagesCount.
// compare(a, b) < 0 - a идёт раньше b.
export const SORTS = {
  new: { title: 'По дате: сначала новые', compare: (a, b) => b.id - a.id },
  old: { title: 'По дате: сначала старые', compare: (a, b) => a.id - b.id },
  'tests-desc': { title: 'По числу тестов: больше', compare: (a, b) => b.testsCount - a.testsCount },
  'tests-asc': { title: 'По числу тестов: меньше', compare: (a, b) => a.testsCount - b.testsCount },
  'categories-desc': { title: 'По числу категорий: больше', compare: (a, b) => b.categoriesCount - a.categoriesCount },
  'categories-asc': { title: 'По числу категорий: меньше', compare: (a, b) => a.categoriesCount - b.categoriesCount },
  'pages-desc': { title: 'По числу страниц: больше', compare: (a, b) => b.pagesCount - a.pagesCount },
  'pages-asc': { title: 'По числу страниц: меньше', compare: (a, b) => a.pagesCount - b.pagesCount },
};

// Вариант сортировки из адреса; неизвестный - «сначала новые»
export function sortFromQuery(value) {
  if (SORTS[value]) return value;
  return 'new';
}
