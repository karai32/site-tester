import { chromium } from '@playwright/test';

const selectors = {
  burger: '.nav-bottom__burger',
};

export const mobileMenu = {
  id: 'mobile-menu',
  title: 'Меню открывается и закрывается корректно на мобильном устройстве',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const burger = page.locator(selectors.burger).first();
      if (await burger.count() === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Не найдена кнопка мобильного меню ${selectors.burger}.` };
      }

      await burger.click();
      await page.waitForTimeout(400);
      const openedLocked = await page.evaluate(() => document.body.classList.contains('no-scroll'));

      if (!openedLocked) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: 'После клика по кнопке меню скролл страницы не заблокировался (класс no-scroll не появился на body).' };
      }

      await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      await burger.click();
      await page.waitForTimeout(400);
      const closedUnlocked = !(await page.evaluate(() => document.body.classList.contains('no-scroll')));

      if (!closedUnlocked) {
        return {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'failed',
          message: 'Меню открылось корректно, но повторный клик по кнопке не закрыл его (класс no-scroll не снялся).',
          screenshot,
        };
      }

      return {
        id: this.id,
        title: this.title, pageUrl: url,
        status: 'passed',
        message: 'Меню открывается по клику (скролл блокируется) и закрывается повторным кликом (скролл разблокируется).',
        screenshot,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
