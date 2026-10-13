// На каждой странице выборки заполнены основные теги Open Graph (превью ссылки в соцсетях)
const requiredOgTags = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];

// Значение <meta property="og:..." content="...">; атрибуты могут идти в любом порядке
function getOgTagContent(html, property) {
  const forward = html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'));
  if (forward) return forward[1].trim();
  const backward = html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, 'i'));
  return backward ? backward[1].trim() : null;
}

export default {
  id: 'open-graph',
  title: 'Open Graph теги (title, description, image, url, type) присутствуют на всех страницах сайта',

  async run({ pages, getHtml }) {
    const problems = [];
    for (const pageUrl of pages) {
      const html = getHtml(pageUrl);
      const missing = requiredOgTags.filter((tag) => !getOgTagContent(html, tag));
      if (missing.length > 0) problems.push(`${pageUrl}: отсутствуют теги ${missing.join(', ')}`);
    }

    return problems.length === 0
      ? { passed: true, comment: `Проверено ${pages.length} HTML-страниц сайта, Open Graph теги заполнены везде.` }
      : { passed: false, comment: `Найдено проблем: ${problems.length}. Проверено ${pages.length} страниц.`, problems };
  },
};
