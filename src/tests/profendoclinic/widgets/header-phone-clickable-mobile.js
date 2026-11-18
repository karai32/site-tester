import { PAGE_TIMEOUT_MS, newPageWithoutCaptcha, takeScreenshot } from '../helpers.js';

const selectors = {
  burger: '.burger',
  phoneLink: '.header__mobile-container .header__phone-link',
};
const internationalNumberPattern = /^tel:\+7\d{10}$/;
const menuOpenTimeoutMs = 3_000;

export default {
  id: 'header-phone-clickable-mobile',
  title: 'Номер телефона в шапке/мобильном меню кликабелен (tel:) на мобильных устройствах',

  async run({ siteUrl, browser }) {
    const page = await newPageWithoutCaptcha(browser, { viewport: { width: 390, height: 844 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

    const burger = page.locator(selectors.burger).first();
    if (!(await burger.isVisible())) {
      return { passed: false, comment: `На мобильном экране не видна кнопка меню ${selectors.burger}.` };
    }
    await burger.click();

    const phoneLink = page.locator(selectors.phoneLink).first();
    if (await phoneLink.count() === 0) {
      return {
        passed: false,
        comment: `В мобильном меню не найден номер телефона (${selectors.phoneLink}).`,
      };
    }
    const visible = await phoneLink.waitFor({ state: 'visible', timeout: menuOpenTimeoutMs }).then(() => true).catch(() => false);

    const media = [await takeScreenshot(page)];
    const href = await phoneLink.getAttribute('href');
    const text = (await phoneLink.textContent() || '').trim();

    const problems = [];
    if (!href || !href.startsWith('tel:')) {
      problems.push(`href не является ссылкой tel: (${href || 'пусто'})`);
    } else if (!internationalNumberPattern.test(href.replace(/[\s()-]/g, ''))) {
      problems.push(`в ссылке ${href} номер записан не в виде +7XXXXXXXXXX: без «+7» набор с телефона может не пройти`);
    }
    if (!visible) problems.push('номер телефона не виден в открытом мобильном меню');

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Номер «${text}» в мобильном меню кликабелен, ведёт на ${href}.`,
        media,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media };
  },
};
