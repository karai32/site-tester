// Мобильное меню открывается и закрывается кнопкой-бургером
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  burger: '.nav-bottom__burger',
};

// Открытое меню блокирует прокрутку страницы классом no-scroll на body
function isScrollLocked(page) {
  return page.evaluate(() => document.body.classList.contains('no-scroll'));
}

export default {
  id: 'mobile-menu',
  title: 'Меню открывается и закрывается корректно на мобильном устройстве',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const burger = page.locator(selectors.burger).first();
    if (await burger.count() === 0) {
      return { passed: false, comment: `Не найдена кнопка мобильного меню ${selectors.burger}.` };
    }

    await burger.click();
    await page.waitForTimeout(400);
    if (!(await isScrollLocked(page))) {
      return {
        passed: false,
        comment: 'После клика по кнопке меню скролл страницы не заблокировался (класс no-scroll не появился на body).',
      };
    }
    const media = [await takeScreenshot(page)];

    await burger.click();
    await page.waitForTimeout(400);
    if (await isScrollLocked(page)) {
      return {
        passed: false,
        comment: 'Меню открылось корректно, но повторный клик по кнопке не закрыл его (класс no-scroll не снялся).',
        media,
      };
    }

    return {
      passed: true,
      comment: 'Меню открывается по клику (скролл блокируется) и закрывается повторным кликом (скролл разблокируется).',
      media,
    };
  },
};
