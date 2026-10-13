// Ключевые страницы открываются в браузере, на главной есть формы.
// Проверяется только Chromium (Chrome, Яндекс Браузер): WebKit (Safari) на сервере не запускается.
import { errorMessage, takeScreenshot } from '../helpers/common.js';

const browserLabel = 'Chromium (Chrome / Yandex Browser)';
const pagesToCheck = ['/', '/price/'];

export default {
  id: 'cross-browser',
  title: 'Ключевые страницы и формы работают в разных браузерах',

  async run({ siteUrl, browser }) {
    const pages = pagesToCheck.map((path) => new URL(path, siteUrl).href);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const problems = [];
    const media = [];
    let formCount = 0;

    for (const target of pages) {
      let response;
      try {
        response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      } catch (error) {
        problems.push(`${browserLabel}, ${target}: ${errorMessage(error)}`);
        continue;
      }

      const status = response.status();
      if (status < 200 || status >= 400) problems.push(`${browserLabel}, ${target}: HTTP ${status}`);

      if (target === pages[0]) formCount = await page.locator('form.wpcf7-form').count().catch(() => 0);
      if (media.length === 0) media.push(await takeScreenshot(page));
    }

    if (formCount === 0) problems.push(`${browserLabel}: на главной странице не найдено форм.`);

    return problems.length === 0
      ? { passed: true, comment: `Проверено в браузере ${browserLabel}. Ключевые страницы и формы загружаются корректно.`, media, pages }
      : { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media, pages };
  },
};
