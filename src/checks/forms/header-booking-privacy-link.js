import { chromium } from '@playwright/test';

const selectors = {
  trigger: 'header [data-modal="call"]',
  privacyLink: '#call form.wpcf7-form .agreement-checkbox a',
};

export const headerBookingPrivacyLink = {
  id: 'header-booking-privacy-link',
  title: 'Ссылка на политику обработки персональных данных в форме записи рабочая',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      await page.locator(selectors.trigger).first().click();
      await page.waitForTimeout(600);

      const link = page.locator(selectors.privacyLink).first();
      if (await link.count() === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: 'В форме записи не найдена ссылка на политику обработки персональных данных.' };
      }

      const href = await link.getAttribute('href');
      if (!href) {
        return { id: this.id, title: this.title, status: 'failed', message: 'У ссылки на политику ПДн в форме отсутствует href.' };
      }

      const target = new URL(href, url).href;
      const response = await context.request.get(target, { failOnStatusCode: false, timeout: 20_000 });
      const status = response.status();
      await response.dispose();

      if (status < 200 || status >= 400) {
        return { id: this.id, title: this.title, status: 'failed', message: `Ссылка на политику ПДн (${target}) вернула HTTP ${status}.` };
      }

      return {
        id: this.id,
        title: this.title,
        status: 'passed',
        message: `Ссылка на политику ПДн в форме записи (${target}) открывается корректно.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
