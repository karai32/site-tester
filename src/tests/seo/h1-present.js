// На каждой странице выборки есть заголовок H1
export default {
  id: 'h1-present',
  title: 'H1 присутствует на всех страницах сайта',

  async run({ pages, getHtml }) {
    const problems = [];
    for (const pageUrl of pages) {
      if (!/<h1\b/i.test(getHtml(pageUrl))) problems.push(`${pageUrl}: H1 отсутствует`);
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${pages.length} HTML-страниц сайта, H1 присутствует на всех.`,
      };
    }
    return {
      passed: false,
      comment: `Найдено проблем: ${problems.length}. Проверено ${pages.length} страниц.`,
      problems,
    };
  },
};
