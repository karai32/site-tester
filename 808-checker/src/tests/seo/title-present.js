// На каждой странице выборки заполнен <title>
function getTitle(html) {
  return html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
}

export default {
  id: 'title-present',
  title: 'Title корректный (присутствует и не пуст) на всех страницах сайта',

  async run({ pages, getHtml }) {
    const problems = [];
    for (const pageUrl of pages) {
      if (!getTitle(getHtml(pageUrl))) problems.push(`${pageUrl}: title отсутствует или пуст`);
    }

    return problems.length === 0
      ? { passed: true, comment: `Проверено ${pages.length} HTML-страниц сайта, у всех заполнен title.` }
      : { passed: false, comment: `Найдено проблем: ${problems.length}. Проверено ${pages.length} страниц.`, problems };
  },
};
