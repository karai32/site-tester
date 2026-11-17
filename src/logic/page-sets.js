export const PAGE_SETS = [
  { id: 'top', title: 'Верхнеуровневые страницы' },
  { id: 'singles-10', title: 'Синглы разных разделов (до 10 шт.)' },
  { id: 'singles-100', title: 'Синглы разных разделов (до 100 шт.)' },
  { id: 'all', title: 'Все страницы сайта' },
];

function pathParts(url) {
  const path = new URL(url).pathname;
  return path.split('/').filter((part) => part !== '');
}

function topPages(pages) {
  return pages.filter((url) => pathParts(url).length <= 1);
}

function singlePages(pages, limit) {
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
    if (addedInRound === 0) break;
  }
  return result;
}

export function selectPages(htmlPages, pageSetIds, siteUrl) {
  let selected = [];
  for (const setId of pageSetIds) {
    if (setId === 'top') selected = selected.concat(topPages(htmlPages));
    if (setId === 'singles-10') selected = selected.concat(singlePages(htmlPages, 10));
    if (setId === 'singles-100') selected = selected.concat(singlePages(htmlPages, 100));
    if (setId === 'all') selected = selected.concat(htmlPages);
  }

  const home = new URL('/', siteUrl).href;
  const result = [];
  if (selected.includes(home)) result.push(home);
  for (const url of selected) {
    if (!result.includes(url)) result.push(url);
  }
  return result;
}
