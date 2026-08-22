import { chromium } from '@playwright/test';

const selectors = {
  whatsappLink: '.header__socials-item.--wa',
};
const expectedPhoneDigits = '74958001000';

export const whatsappButtonLink = {
  id: 'whatsapp-button-link',
  title: 'Кнопка WhatsApp открывает чат с верным номером клиники',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const link = page.locator(selectors.whatsappLink).first();
      if (await link.count() === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: `На странице не найдена кнопка WhatsApp (${selectors.whatsappLink}).` };
      }

      const href = await link.getAttribute('href');
      if (!href || !href.includes(expectedPhoneDigits)) {
        return { id: this.id, title: this.title, status: 'failed', message: `Ссылка WhatsApp (${href || 'пусто'}) не содержит ожидаемый номер ${expectedPhoneDigits}.` };
      }

      const response = await context.request.get(href, { failOnStatusCode: false, timeout: 20_000 });
      const status = response.status();
      const finalUrl = response.url();
      await response.dispose();

      if (status < 200 || status >= 400) {
        return { id: this.id, title: this.title, status: 'failed', message: `Ссылка WhatsApp (${href}) вернула HTTP ${status}.` };
      }

      return {
        id: this.id,
        title: this.title,
        status: 'passed',
        message: `Кнопка WhatsApp ведёт на ${href}, ссылка открывается корректно (итоговый URL: ${finalUrl}).`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
