// Несуществующий адрес отдаёт 404 и показывает свою страницу со ссылкой на главную
import { takeScreenshot } from '../helpers/common.js';

const testPath = '/qa-test-404/';

export default {
  id: 'custom-404-page',
  title: 'Отображение кастомной страницы 404 при переходе на несуществующий URL',

  async run({ siteUrl, browser }) {
    const target = new URL(testPath, siteUrl).href;
    const page = await browser.newPage();
    const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const status = response.status();
    const media = [await takeScreenshot(page)];
    const pages = [target];

    if (status !== 404) {
      return {
        passed: false,
        comment: `Страница ${testPath} вернула HTTP ${status}, ожидался 404.`,
        pages,
        media,
      };
    }

    const main = page.locator('main');
    const mainText = (await main.innerText().catch(() => '')).trim();
    if (!mainText) {
      return {
        passed: false,
        comment: 'HTTP-статус 404 корректный, но блок <main> на странице пуст — кастомное содержимое 404-страницы не выведено.',
        pages,
        media,
      };
    }

    const home = new URL('/', siteUrl).href;
    const hrefs = await main.locator('a[href]').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    const hasHomeLink = hrefs.some((href) => URL.canParse(href, siteUrl) && new URL(href, siteUrl).href === home);

    if (!hasHomeLink) {
      return {
        passed: false,
        comment: 'HTTP-статус 404 корректный, содержимое есть, но на странице нет ссылки для перехода на главную.',
        pages,
        media,
      };
    }

    return {
      passed: true,
      comment: `Страница ${testPath} корректно отдаёт HTTP 404 и содержит ссылку на главную.`,
      pages,
      media,
    };
  },
};
