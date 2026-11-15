import { takeScreenshot } from '../helpers/common.js';

const queries = [
  { text: '', label: 'Пустой запрос' },
  { text: 'asdkjhqwe123zzz', label: 'Бессмысленный запрос' },
];

export default {
  id: 'search-no-results',
  title: 'Поиск по пустому/бессмысленному запросу показывает корректное сообщение «Ничего не найдено»',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const problems = [];
    const media = [];
    const pages = [];

    for (const query of queries) {
      const searchUrl = `${new URL('/', siteUrl).href}?s=${encodeURIComponent(query.text)}`;
      pages.push(searchUrl);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(500);

      const bodyText = await page.evaluate(() => document.body.innerText);
      media.push({ data: await takeScreenshot(page), caption: query.label });

      if (!/ничего не найдено/i.test(bodyText)) {
        const countMatch = bodyText.match(/(\d+)\s*результат/i);
        let shown = 'сообщения нет';
        if (countMatch) shown = `показано результатов: ${countMatch[1]}`;
        problems.push(`${query.label} (${searchUrl}): нет сообщения «Ничего не найдено», ${shown}`);
      }
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: 'По пустому и по бессмысленному запросу показывается сообщение «Ничего не найдено».',
        media,
        pages,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media, pages };
  },
};
