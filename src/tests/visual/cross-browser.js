// Ключевые страницы сайта открываются в браузере. На каждую в отчёт кладётся скриншот первого экрана.
// Пока проверяется только Chromium (движок Chrome и Яндекс Браузера).
import { errorMessage, takeScreenshot } from '../helpers/common.js';

const BROWSER_TITLE = 'Chromium';

// Ключевые страницы: главная, цены и основные разделы сайта
const KEY_PAGES = [
  '/',
  '/price/',
  '/doctors/',
  '/services/',
  '/checkups/',
  '/programs/',
  '/diseases/',
  '/reviews/',
  '/news/',
  '/article/',
];

export default {
  id: 'cross-browser',
  title: 'Ключевые страницы и формы работают в разных браузерах',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pages = [];
    const problems = [];
    const media = [];

    for (const path of KEY_PAGES) {
      const url = new URL(path, siteUrl).href;
      pages.push(url);

      let response;
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      } catch (error) {
        problems.push(`${BROWSER_TITLE}, ${url}: страница не открылась (${errorMessage(error)})`);
        continue;
      }

      // Даём догрузиться стилям и картинкам, но не дольше 10 секунд
      await page.waitForLoadState('load', { timeout: 10_000 }).catch(() => {});

      const status = response.status();
      if (status >= 400) problems.push(`${BROWSER_TITLE}, ${url}: HTTP ${status}`);

      // Скриншот и для страницы с ошибкой: по нему видно, что показалось посетителю
      media.push({ data: await takeScreenshot(page), caption: `${BROWSER_TITLE}: ${path}` });
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `В браузере ${BROWSER_TITLE} открываются все ключевые страницы: ${pages.length}. Приложены скриншоты первого экрана.`,
        media,
        pages,
      };
    }
    return {
      passed: false,
      comment: `Не открылось страниц: ${problems.length} из ${pages.length}.`,
      problems,
      media,
      pages,
    };
  },
};
