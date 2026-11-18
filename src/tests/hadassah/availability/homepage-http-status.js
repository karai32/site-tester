import { PAGE_TIMEOUT_MS } from '../helpers.js';

export default {
  id: 'homepage-http-status',
  title: 'Главная страница загружается без ошибок 4xx/5xx',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();
    const response = await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    const status = response.status();

    if (status >= 200 && status < 400) {
      return { passed: true, comment: `Главная страница загружена. HTTP-статус: ${status}.` };
    }
    return { passed: false, comment: `Главная страница вернула HTTP-статус ${status}.` };
  },
};
