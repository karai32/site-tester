// На каждой странице выборки ровно один H1 и уровни заголовков идут без пропусков (H2 -> H4 - ошибка)
export default {
  id: 'heading-hierarchy',
  title: 'Иерархия заголовков не нарушена (ровно один H1, без пропуска уровней) на всех страницах сайта',

  async run({ pages, getHtml }) {
    const problems = [];

    for (const pageUrl of pages) {
      // Уровни заголовков по порядку: <h1>, <h2>, <h2>, <h3> -> [1, 2, 2, 3]
      const levels = [...getHtml(pageUrl).matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));

      const h1Count = levels.filter((level) => level === 1).length;
      if (h1Count !== 1) {
        problems.push(`${pageUrl}: на странице ${h1Count} тегов H1 (должен быть ровно один)`);
      }

      for (let index = 1; index < levels.length; index += 1) {
        if (levels[index] - levels[index - 1] > 1) {
          problems.push(`${pageUrl}: пропуск уровня заголовка: H${levels[index - 1]} сразу сменяется H${levels[index]}`);
          break;
        }
      }
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${pages.length} HTML-страниц сайта, иерархия заголовков корректна.`,
      };
    }
    return {
      passed: false,
      comment: `Найдено проблем: ${problems.length}. Проверено ${pages.length} страниц.`,
      problems,
    };
  },
};
