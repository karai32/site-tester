// Внутренние ссылки на страницах выборки не ведут на ошибки 4xx/5xx.
// Статусы ссылок уже известны: их собрал обход сайта.
const maxSourcesShown = 5;

function formatSources(foundOn) {
  const shown = foundOn.slice(0, maxSourcesShown);
  const rest = foundOn.length - shown.length;
  return `найдена на: ${shown.join(', ')}${rest > 0 ? ` и ещё ${rest} стр.` : ''}`;
}

export default {
  id: 'broken-links',
  title: 'Отсутствие битых ссылок',

  async run({ siteUrl, links }) {
    const problems = [];
    let checkedCount = 0;

    for (const link of links) {
      if (link.status === null) continue; // обход до этого адреса не дошёл
      checkedCount += 1;

      const isBroken = link.error || link.status < 200 || link.status >= 400;
      if (!isBroken || link.url === siteUrl) continue;

      const reason = link.error || `HTTP ${link.status}`;
      problems.push(`${link.url}: ${reason} (${formatSources(link.foundOn)})`);
    }

    return problems.length === 0
      ? { passed: true, comment: `Проверено ${checkedCount} внутренних ссылок (страниц и файлов), битых ссылок не найдено.` }
      : { passed: false, comment: `Найдено проблем: ${problems.length}. Проверено ${checkedCount} ссылок.`, problems };
  },
};
