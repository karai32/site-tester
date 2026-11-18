import { PAGE_TIMEOUT_MS, newPageWithoutCaptcha, takeScreenshot } from '../helpers.js';

const selectors = {
  cardLink: '.slider-experts .experts-card__button',
  name: '.doctor__title',
  about: '.doctor__about',
  price: '.doctor__price',
  appointmentButton: '.doctor__button',
};

const requiredFields = [
  [selectors.name, 'имя врача'],
  [selectors.about, 'должность/специализация'],
  [selectors.price, 'стоимость приёма'],
];

export default {
  id: 'doctor-profile-open',
  title: 'Открытие полной страницы врача из карточки со всеми данными',

  async run({ siteUrl, browser }) {
    const page = await newPageWithoutCaptcha(browser, { viewport: { width: 1440, height: 900 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

    const cardLink = page.locator(selectors.cardLink).first();
    if (await cardLink.count() === 0) {
      return {
        passed: false,
        comment: `На главной странице не найдено ни одной карточки врача со ссылкой «подробнее» (${selectors.cardLink}).`,
      };
    }

    const profileUrl = await cardLink.evaluate((link) => link.href);
    await cardLink.click();
    await page.waitForURL(profileUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    const media = [await takeScreenshot(page)];
    const pages = [siteUrl, profileUrl];

    const fieldTexts = await page.evaluate((fieldSelectors) => fieldSelectors
      .map((selector) => (document.querySelector(selector)?.textContent || '').replace(/\s+/g, ' ').trim()), requiredFields.map(([selector]) => selector));

    const problems = [];
    requiredFields.forEach(([selector, label], index) => {
      if (!fieldTexts[index]) problems.push(`не заполнено поле «${label}» (${selector})`);
    });
    if (!(await page.locator(selectors.appointmentButton).first().isVisible())) {
      problems.push('кнопка записи на приём не видна');
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Страница врача «${fieldTexts[0]}» (${profileUrl}) открылась из карточки, содержит должность/специализацию, стоимость приёма и кнопку записи.`,
        media,
        pages,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media, pages };
  },
};
