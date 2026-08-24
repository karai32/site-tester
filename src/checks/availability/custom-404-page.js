import { chromium } from '@playwright/test';

const testPath = '/qa-test-404/';

export const custom404Page = {
  id: 'custom-404-page',
  title: 'Отображение кастомной страницы 404 при переходе на несуществующий URL',

  async run({ url }) {
    let browser;
    const target = new URL(testPath, url).href;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage();
      const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      if (!response) {
        throw new Error('браузер не получил ответ от сайта');
      }

      const status = response.status();
      if (status !== 404) {
        return { id: this.id, title: this.title, pageUrl: target, status: 'failed', message: `Страница ${testPath} вернула HTTP ${status}, ожидался 404.` };
      }

      const main = page.locator('main');
      const mainText = (await main.innerText().catch(() => '')).trim();
      if (!mainText) {
        return {
          id: this.id,
          title: this.title, pageUrl: target,
          status: 'failed',
          message: 'HTTP-статус 404 корректный, но блок <main> на странице пуст — кастомное содержимое 404-страницы не выведено.',
        };
      }

      const home = new URL('/', url).href;
      const hrefs = await main.locator('a[href]').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      const hasHomeLink = hrefs.some((href) => {
        try {
          return new URL(href, url).href === home;
        } catch {
          return false;
        }
      });

      if (!hasHomeLink) {
        return {
          id: this.id,
          title: this.title, pageUrl: target,
          status: 'failed',
          message: 'HTTP-статус 404 корректный, содержимое есть, но на странице нет ссылки для перехода на главную.',
        };
      }

      return {
        id: this.id,
        title: this.title, pageUrl: target,
        status: 'passed',
        message: `Страница ${testPath} корректно отдаёт HTTP 404 и содержит ссылку на главную.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: target, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
