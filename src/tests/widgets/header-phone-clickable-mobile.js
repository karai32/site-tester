// На телефоне номер в мобильном меню виден и звонит по клику (ссылка tel:)
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  burger: '.nav-bottom__burger',
  phoneLink: '.more__phone',
};

export default {
  id: 'header-phone-clickable-mobile',
  title: 'Номер телефона в шапке/мобильном меню кликабелен (tel:) на мобильных устройствах',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1_500);

    await page.locator(selectors.burger).first().click();
    await page.waitForTimeout(500);

    const phoneLink = page.locator(selectors.phoneLink).first();
    if (await phoneLink.count() === 0) {
      return {
        passed: false,
        comment: `В мобильном меню не найден номер телефона (${selectors.phoneLink}).`,
      };
    }

    await phoneLink.scrollIntoViewIfNeeded();
    const media = [await takeScreenshot(page)];
    const href = await phoneLink.getAttribute('href');
    const text = (await phoneLink.textContent() || '').trim();

    const problems = [];
    if (!href || !href.startsWith('tel:')) problems.push(`href не является ссылкой tel: (${href || 'пусто'})`);
    if (!(await phoneLink.isVisible())) problems.push('номер телефона не виден в открытом мобильном меню');

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
