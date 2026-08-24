import { chromium } from '@playwright/test';

export const homepageHttpStatus = {
  id: 'homepage-http-status',
  title: 'Главная страница загружается без ошибок 4xx/5xx',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage();
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      if (!response) {
        throw new Error('браузер не получил ответ от сайта');
      }

      const status = response.status();
      return status >= 200 && status < 400
        ? { id: this.id, title: this.title, status: 'passed', message: `Главная страница загружена. HTTP-статус: ${status}.`, pageUrl: url }
        : { id: this.id, title: this.title, status: 'failed', message: `Главная страница вернула HTTP-статус ${status}.`, pageUrl: url };
    } catch (error) {
      const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Главная страница не загрузилась: ${reason}`, pageUrl: url };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
