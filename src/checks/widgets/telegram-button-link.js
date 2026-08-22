import { chromium } from '@playwright/test';

const selectors = {
  telegramLink: '.header__socials-item.--tg',
};
const expectedUsername = 'AskHadassahBot';

export const telegramButtonLink = {
  id: 'telegram-button-link',
  title: 'Кнопка Telegram открывает верный @username/бот',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const link = page.locator(selectors.telegramLink).first();
      if (await link.count() === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: `На странице не найдена кнопка Telegram (${selectors.telegramLink}).` };
      }

      const href = await link.getAttribute('href');
      if (!href || !href.includes(expectedUsername)) {
        return { id: this.id, title: this.title, status: 'failed', message: `Ссылка Telegram (${href || 'пусто'}) не содержит ожидаемый username ${expectedUsername}.` };
      }

      const response = await context.request.get(href, { failOnStatusCode: false, timeout: 20_000 });
      const status = response.status();
      await response.dispose();

      if (status < 200 || status >= 400) {
        return { id: this.id, title: this.title, status: 'failed', message: `Ссылка Telegram (${href}) вернула HTTP ${status}.` };
      }

      return {
        id: this.id,
        title: this.title,
        status: 'passed',
        message: `Кнопка Telegram ведёт на ${href}, ссылка открывается корректно.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
