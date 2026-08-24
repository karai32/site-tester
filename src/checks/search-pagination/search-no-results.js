import { chromium } from '@playwright/test';

const nonsenseQuery = 'asdkjhqwe123zzz';

export const searchNoResults = {
  id: 'search-no-results',
  title: 'Поиск по пустому/бессмысленному запросу показывает корректное сообщение «Ничего не найдено»',

  async run({ url }) {
    let browser;
    const searchUrl = `${new URL('/', url).href}?s=${encodeURIComponent(nonsenseQuery)}`;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(500);

      const bodyText = await page.evaluate(() => document.body.innerText);
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      const hasNoResultsMessage = /ничего не найдено/i.test(bodyText);
      if (!hasNoResultsMessage) {
        return {
          id: this.id,
          title: this.title, pageUrl: searchUrl,
          status: 'failed',
          message: `На странице ${searchUrl} нет ожидаемого сообщения «Ничего не найдено».`,
          screenshot,
        };
      }

      return {
        id: this.id,
        title: this.title, pageUrl: searchUrl,
        status: 'passed',
        message: 'По бессмысленному запросу корректно показывается сообщение «Ничего не найдено».',
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
