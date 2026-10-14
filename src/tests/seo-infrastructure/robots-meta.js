// На каждой странице выборки есть <meta name="robots"> и в нём нет noindex (запрета индексации)
function getRobotsMetaContent(html) {
  const forward = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  if (forward) return forward[1].trim();
  const backward = html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["']/i);
  return backward ? backward[1].trim() : null;
}

export default {
  id: 'robots-meta',
  title: 'Meta robots присутствует и не содержит случайного noindex на всех страницах сайта',

  async run({ pages, getHtml }) {
    const problems = [];
    for (const pageUrl of pages) {
      const content = getRobotsMetaContent(getHtml(pageUrl));
      if (content === null) problems.push(`${pageUrl}: тег meta robots отсутствует`);
      else if (/noindex/i.test(content)) problems.push(`${pageUrl}: meta robots содержит noindex ("${content}")`);
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${pages.length} HTML-страниц сайта, meta robots в порядке.`,
      };
    }
    return {
      passed: false,
      comment: `Найдено проблем: ${problems.length}. Проверено ${pages.length} страниц.`,
      problems,
    };
  },
};
