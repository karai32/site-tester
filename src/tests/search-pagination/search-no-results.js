// По бессмысленному запросу поиск пишет «Ничего не найдено»
import { takeScreenshot } from '../helpers/common.js';

const nonsenseQuery = 'asdkjhqwe123zzz';

export default {
  id: 'search-no-results',
  title: 'Поиск по пустому/бессмысленному запросу показывает корректное сообщение «Ничего не найдено»',

  async run({ siteUrl, browser }) {
    const searchUrl = `${new URL('/', siteUrl).href}?s=${encodeURIComponent(nonsenseQuery)}`;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(500);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const media = [await takeScreenshot(page)];
    const pages = [searchUrl];

    if (/ничего не найдено/i.test(bodyText)) {
      return {
        passed: true,
        comment: 'По бессмысленному запросу корректно показывается сообщение «Ничего не найдено».',
        media,
        pages,
      };
    }
    return {
      passed: false,
      comment: `На странице ${searchUrl} нет ожидаемого сообщения «Ничего не найдено».`,
      media,
      pages,
    };
  },
};
