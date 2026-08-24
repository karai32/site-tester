import { chromium } from '@playwright/test';

const selectors = {
  burger: '.nav-bottom__burger',
  phoneLink: '.more__phone',
};

export const headerPhoneClickableMobile = {
  id: 'header-phone-clickable-mobile',
  title: 'Номер телефона в шапке/мобильном меню кликабелен (tel:) на мобильных устройствах',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(1_500);

      await page.locator(selectors.burger).first().click();
      await page.waitForTimeout(500);

      const phoneLink = page.locator(selectors.phoneLink).first();
      if (await phoneLink.count() === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `В мобильном меню не найден номер телефона (${selectors.phoneLink}).` };
      }

      await phoneLink.scrollIntoViewIfNeeded();
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      const href = await phoneLink.getAttribute('href');
      const visible = await phoneLink.isVisible();
      const text = (await phoneLink.textContent() || '').trim();

      const problems = [];
      if (!href || !href.startsWith('tel:')) {
        problems.push(`href не является ссылкой tel: (${href || 'пусто'})`);
      }
      if (!visible) {
        problems.push('номер телефона не виден в открытом мобильном меню');
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'passed',
          message: `Номер «${text}» в мобильном меню кликабелен, ведёт на ${href}.`,
          screenshot,
        }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. ${problems.join('; ')}.`, screenshot };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
