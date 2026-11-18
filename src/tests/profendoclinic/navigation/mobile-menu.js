import { PAGE_TIMEOUT_MS, newPageWithoutCaptcha, takeScreenshot } from '../helpers.js';

const selectors = {
  burger: '.burger',
  menu: '.header__mobile-container .menu-header',
};
const toggleTimeoutMs = 3_000;

export default {
  id: 'mobile-menu',
  title: 'Меню открывается и закрывается корректно на мобильном устройстве',

  async run({ siteUrl, browser }) {
    const page = await newPageWithoutCaptcha(browser, { viewport: { width: 390, height: 844 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

    const burger = page.locator(selectors.burger).first();
    const menu = page.locator(selectors.menu).first();
    if (!(await burger.isVisible())) {
      return { passed: false, comment: `На мобильном экране не видна кнопка меню ${selectors.burger}.` };
    }
    if (await menu.isVisible()) {
      return { passed: false, comment: 'Мобильное меню открыто сразу после загрузки страницы, до клика по кнопке.' };
    }

    await burger.click();
    const opened = await menu.waitFor({ state: 'visible', timeout: toggleTimeoutMs }).then(() => true).catch(() => false);
    if (!opened) {
      return {
        passed: false,
        comment: `После клика по кнопке меню мобильное меню не открылось (${selectors.menu} не появился).`,
        media: [await takeScreenshot(page)],
      };
    }
    const media = [await takeScreenshot(page)];

    await burger.click();
    const closed = await menu.waitFor({ state: 'hidden', timeout: toggleTimeoutMs }).then(() => true).catch(() => false);
    if (!closed) {
      return {
        passed: false,
        comment: 'Меню открылось корректно, но повторный клик по кнопке не закрыл его.',
        media,
      };
    }

    return {
      passed: true,
      comment: 'Меню открывается по клику на кнопку и закрывается повторным кликом.',
      media,
    };
  },
};
