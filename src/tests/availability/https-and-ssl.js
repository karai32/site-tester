// Сайт открывается по HTTPS, и браузер принимает его сертификат
import { errorMessage } from '../helpers/common.js';

export default {
  id: 'https-and-ssl',
  title: 'Сайт открывается по https, есть корректный SSL-сертификат, нет предупреждений браузера',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();

    let response;
    try {
      // Браузер сам откажется открывать сайт с плохим сертификатом
      response = await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch (error) {
      return { passed: false, comment: `Ошибка HTTPS/SSL: ${errorMessage(error)}` };
    }

    if (new URL(page.url()).protocol !== 'https:') {
      return { passed: false, comment: 'Сайт открылся без HTTPS.' };
    }

    const security = await response.securityDetails();
    const protocol = security?.protocol ? ` Протокол: ${security.protocol}.` : '';
    return { passed: true, comment: `Сайт открыт по HTTPS. Chromium принял SSL-сертификат без предупреждений.${protocol}` };
  },
};
