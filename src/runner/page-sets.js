// Выборки тестирования: какие страницы сайта попадают в проверку.
// Сценарий хранит id выборок, например ["top", "singles-10"].

export const PAGE_SETS = [
  { id: 'top', title: 'Верхнеуровневые страницы' },
  { id: 'singles-10', title: 'Синглы разных разделов (до 10 шт.)' },
  { id: 'singles-100', title: 'Синглы разных разделов (до 100 шт.)' },
  { id: 'all', title: 'Все страницы сайта' },
];

// Части пути: https://site.ru/doctors/ivanov/ → ['doctors', 'ivanov']
function pathParts(url) {
  return new URL(url).pathname.split('/').filter(Boolean);
}

// Главная и страницы первого уровня: /, /doctors/, /price/
function topPages(pages) {
  return pages.filter((url) => pathParts(url).length <= 1);
}

// Синглы — страницы глубже первого уровня: /doctors/ivanov/.
// Берём по очереди по одной странице из каждого раздела, пока не наберём limit.
function singlePages(pages, limit) {
  const sections = new Map(); // раздел → его страницы
  for (const url of pages) {
    const parts = pathParts(url);
    if (parts.length < 2) continue;
    if (!sections.has(parts[0])) sections.set(parts[0], []);
    sections.get(parts[0]).push(url);
  }

  const result = [];
  const lists = [...sections.values()];
  for (let index = 0; result.length < limit; index += 1) {
    const round = lists.filter((list) => index < list.length).map((list) => list[index]);
    if (round.length === 0) break;
    result.push(...round.slice(0, limit - result.length));
  }
  return result;
}

// Страницы для проверки по списку выборок. Если главная попала в выборку, она первая.
export function selectPages(htmlPages, pageSetIds, siteUrl) {
  const selected = new Set();
  for (const setId of pageSetIds) {
    if (setId === 'top') topPages(htmlPages).forEach((url) => selected.add(url));
    if (setId === 'singles-10') singlePages(htmlPages, 10).forEach((url) => selected.add(url));
    if (setId === 'singles-100') singlePages(htmlPages, 100).forEach((url) => selected.add(url));
    if (setId === 'all') htmlPages.forEach((url) => selected.add(url));
  }

  const home = new URL('/', siteUrl).href;
  const pages = [...selected].filter((url) => url !== home);
  return selected.has(home) ? [home, ...pages] : pages;
}

// Внутренние ссылки, найденные на выбранных страницах:
// [{ url, status, error, foundOn: [страницы, где стоит ссылка] }]
export function collectLinks(pages, linksByPage, statuses) {
  const links = new Map();
  for (const pageUrl of pages) {
    for (const url of linksByPage.get(pageUrl) || []) {
      if (!links.has(url)) {
        const { status = null, error = null } = statuses.get(url) || {};
        links.set(url, { url, status, error, foundOn: [] });
      }
      links.get(url).foundOn.push(pageUrl);
    }
  }
  return [...links.values()];
}
