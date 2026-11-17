export function paginate(list, page, perPage) {
  const pagesCount = Math.max(1, Math.ceil(list.length / perPage));

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

export function toList(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  return [value];
}

export function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

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

export function sortFromQuery(value) {
  if (SORTS[value]) return value;
  return 'new';
}
