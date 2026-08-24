import { chromium } from '@playwright/test';

const query = 'онколог';

export const searchResults = {
  id: 'search-results',
  title: 'Поиск по сайту возвращает релевантные результаты по запросу',

  async run({ url }) {
    let browser;
    const searchUrl = `${new URL('/', url).href}?s=${encodeURIComponent(query)}`;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const bodyText = await page.evaluate(() => document.body.innerText);
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      const countMatch = bodyText.match(/(\d+)\s*результ/i);
      const resultCount = countMatch ? Number(countMatch[1]) : 0;

      if (resultCount === 0) {
        return {
          id: this.id,
          title: this.title, pageUrl: searchUrl,
          status: 'failed',
          message: `По запросу «${query}» на странице ${searchUrl} не найдено результатов (ожидались релевантные страницы).`,
          screenshot,
        };
      }

      return {
        id: this.id,
        title: this.title, pageUrl: searchUrl,
        status: 'passed',
        message: `По запросу «${query}» найдено ${resultCount} результатов.`,
        screenshot,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: searchUrl, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
