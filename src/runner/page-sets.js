// Выборки тестирования: какие страницы сайта попадают в проверку.
// Сценарий хранит id выборок, например ["top", "singles-10"].

export const PAGE_SETS = [
  { id: 'top', title: 'Верхнеуровневые страницы' },
  { id: 'singles-10', title: 'Синглы разных разделов (до 10 шт.)' },
  { id: 'singles-100', title: 'Синглы разных разделов (до 100 шт.)' },
  { id: 'all', title: 'Все страницы сайта' },
];

// Части пути: https://site.ru/doctors/ivanov/ -> ['doctors', 'ivanov']
function pathParts(url) {
  const path = new URL(url).pathname;
  return path.split('/').filter((part) => part !== '');
}

// Главная и страницы первого уровня: /, /doctors/, /price/
function topPages(pages) {
  return pages.filter((url) => pathParts(url).length <= 1);
}

// Синглы - страницы глубже первого уровня: /doctors/ivanov/.
// Чтобы попали разные разделы, берём страницы по кругу: первую из каждого раздела,
// потом вторую из каждого и так далее, пока не наберём limit.
function singlePages(pages, limit) {
  // Разделы и их страницы: { doctors: [/doctors/a/, /doctors/b/], news: [/news/x/] }
  const sections = {};
  for (const url of pages) {
    const parts = pathParts(url);
    if (parts.length < 2) continue;

    const section = parts[0];
    if (!sections[section]) sections[section] = [];
    sections[section].push(url);
  }

  const result = [];
  for (let round = 0; result.length < limit; round += 1) {
    let addedInRound = 0;
    for (const sectionPages of Object.values(sections)) {
      if (round < sectionPages.length && result.length < limit) {
        result.push(sectionPages[round]);
        addedInRound += 1;
      }
    }
    if (addedInRound === 0) break; // страницы во всех разделах закончились
  }
  return result;
}

// Страницы для проверки по списку выборок. Если главная попала в выборку, она первая.
export function selectPages(htmlPages, pageSetIds, siteUrl) {
  // Собираем страницы всех выборок; одна страница может попасть в несколько выборок
  let selected = [];
  for (const setId of pageSetIds) {
    if (setId === 'top') selected = selected.concat(topPages(htmlPages));
    if (setId === 'singles-10') selected = selected.concat(singlePages(htmlPages, 10));
    if (setId === 'singles-100') selected = selected.concat(singlePages(htmlPages, 100));
    if (setId === 'all') selected = selected.concat(htmlPages);
  }

  // Убираем повторы, главную ставим первой
  const home = new URL('/', siteUrl).href;
  const result = [];
  if (selected.includes(home)) result.push(home);
  for (const url of selected) {
    if (!result.includes(url)) result.push(url);
  }
  return result;
}

// Внутренние ссылки, найденные на выбранных страницах:
// [{ url, status, error, foundOn: [страницы, где стоит ссылка] }]
export function collectLinks(pages, linksByPage, statuses) {
  const links = new Map(); // адрес ссылки -> { url, status, error, foundOn }

  for (const pageUrl of pages) {
    for (const url of linksByPage.get(pageUrl) || []) {
      // Первая встреча ссылки - запоминаем её статус из обхода (если обход до неё дошёл)
      if (!links.has(url)) {
        const known = statuses.get(url);
        links.set(url, {
          url,
          status: known ? known.status : null,
          error: known ? known.error : null,
          foundOn: [],
        });
      }
      links.get(url).foundOn.push(pageUrl);
    }
  }

  return Array.from(links.values());
}
