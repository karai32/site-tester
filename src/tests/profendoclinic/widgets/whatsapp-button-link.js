import { PAGE_TIMEOUT_MS } from '../helpers.js';

const selectors = {
  whatsappLink: '.header__socials a[href*="wa.me"]',
};
const expectedPhoneDigits = '79165393277';

export default {
  id: 'whatsapp-button-link',
  title: 'Кнопка WhatsApp открывает чат с верным номером клиники',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

    const link = page.locator(selectors.whatsappLink).first();
    if (await link.count() === 0) {
      return {
        passed: false,
        comment: `На странице не найдена кнопка WhatsApp (${selectors.whatsappLink}).`,
      };
    }

    const href = await link.getAttribute('href');
    if (!href || !href.replace(/\D/g, '').includes(expectedPhoneDigits)) {
      return {
        passed: false,
        comment: `Ссылка WhatsApp (${href || 'пусто'}) не содержит ожидаемый номер ${expectedPhoneDigits}.`,
      };
    }

    const response = await page.request.get(href, { failOnStatusCode: false, timeout: 20_000 });
    const status = response.status();
    const finalUrl = response.url();
    await response.dispose();

    if (status >= 200 && status < 400) {
      return {
        passed: true,
        comment: `Кнопка WhatsApp ведёт на ${href}, ссылка открывается корректно (итоговый URL: ${finalUrl}).`,
      };
    }
    return { passed: false, comment: `Ссылка WhatsApp (${href}) вернула HTTP ${status}.` };
  },
};
