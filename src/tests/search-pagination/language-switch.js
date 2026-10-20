// Переключатель языка в шапке меняет язык сайта на английский
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  langHeader: '.header__lang-header',
  langOptionEng: '.header__lang-dropdown-item[data-lang="eng"]',
};

export default {
  id: 'language-switch',
  title: 'Переключение между RU/EN версией сайта работает корректно',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const langBefore = await page.evaluate(() => document.documentElement.lang);
    const urlBefore = page.url();
    const media = [{ data: await takeScreenshot(page, { fullPage: true }), caption: 'До переключения' }];

    const langOption = page.locator(selectors.langOptionEng).first();
    if (await langOption.count() === 0) {
      return { passed: false, comment: 'На странице не найден переключатель языка на английский.', media };
    }

    await page.locator(selectors.langHeader).first().click();
    await page.waitForTimeout(300);
    await langOption.click();
    await page.waitForTimeout(1_000);

    const langAfter = await page.evaluate(() => document.documentElement.lang);
    const urlAfter = page.url();
    media.push({ data: await takeScreenshot(page, { fullPage: true }), caption: 'После переключения' });

    if (langAfter === langBefore && urlAfter === urlBefore) {
      return {
        passed: false,
        comment: `Клик по переключателю языка ничего не меняет: URL остался ${urlAfter}, html[lang] остался «${langAfter}». Переключатель нефункционален.`,
        media,
      };
    }

    return {
      passed: true,
      comment: `После переключения языка: URL: ${urlAfter}, html[lang]: «${langAfter}».`,
      media,
    };
  },
};
