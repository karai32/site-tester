// Из карточки врача на главной открывается его страница со всеми данными
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  cardNameLink: '.doctor-item__name a',
  heroName: '.doctor-hero__name',
  heroPosition: '.doctor-hero__pos',
  heroProfession: '.doctor-hero__prof',
  heroCost: '.doctor-hero__cost',
  heroButton: '.doctor-hero__button',
};

// Поля страницы врача, которые должны быть заполнены
const requiredFields = [
  [selectors.heroName, 'имя врача'],
  [selectors.heroPosition, 'должность'],
  [selectors.heroProfession, 'описание/квалификация'],
  [selectors.heroCost, 'стоимость приёма'],
];

export default {
  id: 'doctor-profile-open',
  title: 'Открытие полной страницы врача из карточки со всеми данными',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const cardLink = page.locator(selectors.cardNameLink).first();
    if (await cardLink.count() === 0) {
      return {
        passed: false,
        comment: 'На главной странице не найдено ни одной карточки врача с именем-ссылкой.',
      };
    }

    const href = await cardLink.getAttribute('href');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      cardLink.evaluate((link) => link.click()),
    ]);
    const media = [await takeScreenshot(page)];
    const pages = [siteUrl, page.url()];

    const problems = [];
    for (const [selector, label] of requiredFields) {
      const text = (await page.locator(selector).first().textContent().catch(() => '') || '').trim();
      if (!text) problems.push(`не заполнено поле «${label}» (${selector})`);
    }
    if (!(await page.locator(selectors.heroButton).first().isVisible().catch(() => false))) {
      problems.push('кнопка записи на приём не видна');
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Страница врача (${href}) открылась из карточки, содержит должность, описание, стоимость приёма и кнопку записи.`,
        media,
        pages,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media, pages };
  },
};
