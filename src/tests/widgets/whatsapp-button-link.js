// Кнопка WhatsApp в шапке ведёт на номер клиники, ссылка открывается
const selectors = {
  whatsappLink: '.header__socials-item.--wa',
};
const expectedPhoneDigits = '74958001000';

export default {
  id: 'whatsapp-button-link',
  title: 'Кнопка WhatsApp открывает чат с верным номером клиники',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const link = page.locator(selectors.whatsappLink).first();
    if (await link.count() === 0) {
      return { passed: false, comment: `На странице не найдена кнопка WhatsApp (${selectors.whatsappLink}).` };
    }

    const href = await link.getAttribute('href');
    if (!href || !href.includes(expectedPhoneDigits)) {
      return { passed: false, comment: `Ссылка WhatsApp (${href || 'пусто'}) не содержит ожидаемый номер ${expectedPhoneDigits}.` };
    }

    const response = await page.request.get(href, { failOnStatusCode: false, timeout: 20_000 });
    const status = response.status();
    const finalUrl = response.url();
    await response.dispose();

    return status >= 200 && status < 400
      ? { passed: true, comment: `Кнопка WhatsApp ведёт на ${href}, ссылка открывается корректно (итоговый URL: ${finalUrl}).` }
      : { passed: false, comment: `Ссылка WhatsApp (${href}) вернула HTTP ${status}.` };
  },
};
