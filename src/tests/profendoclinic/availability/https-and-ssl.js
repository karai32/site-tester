import { PAGE_TIMEOUT_MS, errorMessage } from '../helpers.js';

export default {
  id: 'https-and-ssl',
  title: 'Сайт открывается по https, есть корректный SSL-сертификат, нет предупреждений браузера',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();

    let response;
    try {
      response = await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    } catch (error) {
      return { passed: false, comment: `Ошибка HTTPS/SSL: ${errorMessage(error)}` };
    }

    if (new URL(page.url()).protocol !== 'https:') {
      return { passed: false, comment: 'Сайт открылся без HTTPS.' };
    }

    const security = await response.securityDetails();
    const protocol = security?.protocol ? ` Протокол: ${security.protocol}.` : '';
    return {
      passed: true,
      comment: `Сайт открыт по HTTPS. Chromium принял SSL-сертификат без предупреждений.${protocol}`,
    };
  },
};
