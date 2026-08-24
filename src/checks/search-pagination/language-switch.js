import { chromium } from '@playwright/test';

const selectors = {
  langHeader: '.header__lang-header',
  langOptionEng: '.header__lang-dropdown-item[data-lang="eng"]',
};

export const languageSwitch = {
  id: 'language-switch',
  title: 'Переключение между RU/EN версией сайта работает корректно',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const langBefore = await page.evaluate(() => document.documentElement.lang);
      const urlBefore = page.url();

      const langOption = page.locator(selectors.langOptionEng).first();
      if (await langOption.count() === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: 'На странице не найден переключатель языка на английский.' };
      }

      await page.locator(selectors.langHeader).first().click();
      await page.waitForTimeout(300);
      await langOption.click();
      await page.waitForTimeout(1_000);

      const langAfter = await page.evaluate(() => document.documentElement.lang);
      const urlAfter = page.url();

      if (langAfter === langBefore && urlAfter === urlBefore) {
        return {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'failed',
          message: `Клик по переключателю языка ничего не меняет: URL остался ${urlAfter}, html[lang] остался «${langAfter}». Переключатель нефункционален.`,
        };
      }

      return {
        id: this.id,
        title: this.title, pageUrl: url,
        status: 'passed',
        message: `После переключения языка: URL — ${urlAfter}, html[lang] — «${langAfter}».`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
