import { chromium } from '@playwright/test';

const selectors = {
  upButton: '.btn--up',
};

export const scrollToTop = {
  id: 'scroll-to-top',
  title: 'Кнопка «наверх» работает корректно',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const upButton = page.locator(selectors.upButton).first();
      if (await upButton.count() === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: `Не найдена кнопка «наверх» ${selectors.upButton}.` };
      }

      await page.evaluate(() => window.scrollTo(0, 3000));
      await page.waitForTimeout(300);
      const scrolledDown = await page.evaluate(() => window.scrollY > 500);

      if (!scrolledDown) {
        return { id: this.id, title: this.title, status: 'failed', message: 'Не удалось прокрутить страницу вниз для проверки кнопки.' };
      }

      await page.evaluate((selector) => document.querySelector(selector)?.click(), selectors.upButton);
      await page.waitForTimeout(1_000);
      const scrollY = await page.evaluate(() => window.scrollY);

      return scrollY < 50
        ? { id: this.id, title: this.title, status: 'passed', message: `Кнопка «наверх» вернула страницу к началу (scrollY=${scrollY}).` }
        : { id: this.id, title: this.title, status: 'failed', message: `После клика по кнопке «наверх» страница не вернулась к началу (scrollY=${scrollY}).` };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
