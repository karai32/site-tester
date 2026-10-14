// Разбивка списка на страницы.
// paginate(reports, 2, 10) → { items: отчёты 11–20, page: 2, pagesCount, total, from: 11, to: 20, numbers }
// numbers — номера страниц для кнопок, '…' — пропуск: [1, '…', 4, 5, 6, '…', 12]
export function paginate(list, page, perPage) {
  const pagesCount = Math.max(1, Math.ceil(list.length / perPage));
  const current = Math.min(Math.max(1, page), pagesCount);
  const start = (current - 1) * perPage;

  return {
    items: list.slice(start, start + perPage),
    page: current,
    pagesCount,
    total: list.length,
    from: list.length === 0 ? 0 : start + 1,
    to: Math.min(start + perPage, list.length),
    numbers: pageNumbers(current, pagesCount),
  };
}

function pageNumbers(page, pagesCount) {
  if (pagesCount <= 7) return Array.from({ length: pagesCount }, (_value, index) => index + 1);

  const numbers = [1];
  if (page > 3) numbers.push('…');
  for (let number = Math.max(2, page - 1); number <= Math.min(pagesCount - 1, page + 1); number += 1) {
    numbers.push(number);
  }
  if (page < pagesCount - 2) numbers.push('…');
  numbers.push(pagesCount);
  return numbers;
}

// Адрес списка с параметрами фильтров: listUrl('/projects/1/reports', { q: 'аудит', cat: ['seo'], page: 2 })
// Пустые значения в адрес не попадают.
export function listUrl(path, params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of [value].flat()) if (item) query.append(key, item);
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
