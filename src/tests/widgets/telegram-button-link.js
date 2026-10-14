// Кнопка Telegram в шапке ведёт на бот клиники, ссылка открывается
const selectors = {
  telegramLink: '.header__socials-item.--tg',
};
const expectedUsername = 'AskHadassahBot';

export default {
  id: 'telegram-button-link',
  title: 'Кнопка Telegram открывает верный @username/бот',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const link = page.locator(selectors.telegramLink).first();
    if (await link.count() === 0) {
      return {
        passed: false,
        comment: `На странице не найдена кнопка Telegram (${selectors.telegramLink}).`,
      };
    }

    const href = await link.getAttribute('href');
    if (!href || !href.includes(expectedUsername)) {
      return {
        passed: false,
        comment: `Ссылка Telegram (${href || 'пусто'}) не содержит ожидаемый username ${expectedUsername}.`,
      };
    }

    const response = await page.request.get(href, { failOnStatusCode: false, timeout: 20_000 });
    const status = response.status();
    await response.dispose();

    if (status >= 200 && status < 400) {
      return { passed: true, comment: `Кнопка Telegram ведёт на ${href}, ссылка открывается корректно.` };
    }
    return { passed: false, comment: `Ссылка Telegram (${href}) вернула HTTP ${status}.` };
  },
};
