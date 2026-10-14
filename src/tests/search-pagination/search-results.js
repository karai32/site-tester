// Поиск по сайту находит страницы по обычному запросу
import { takeScreenshot } from '../helpers/common.js';

const query = 'онколог';

export default {
  id: 'search-results',
  title: 'Поиск по сайту возвращает релевантные результаты по запросу',

  async run({ siteUrl, browser }) {
    const searchUrl = `${new URL('/', siteUrl).href}?s=${encodeURIComponent(query)}`;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const bodyText = await page.evaluate(() => document.body.innerText);
    const media = [await takeScreenshot(page)];
    const pages = [searchUrl];

    // На странице поиска есть строка вида «Найдено 29 результатов»
    const countMatch = bodyText.match(/(\d+)\s*результ/i);
    const resultCount = countMatch ? Number(countMatch[1]) : 0;

    if (resultCount > 0) {
      return {
        passed: true,
        comment: `По запросу «${query}» найдено ${resultCount} результатов.`,
        media,
        pages,
      };
    }
    return {
      passed: false,
      comment: `По запросу «${query}» на странице ${searchUrl} не найдено результатов (ожидались релевантные страницы).`,
      media,
      pages,
    };
  },
};
