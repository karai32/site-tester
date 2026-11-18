import { PAGE_TIMEOUT_MS, getStatuses, newPageWithoutCaptcha, takeScreenshot } from '../helpers.js';

const selectors = {
  block: '.slider-experts',
  card: '.slider-experts .experts-card',
  photo: '.experts-card__img',
  name: '.experts-card__title',
  about: '.experts-card__position, .experts-card__specialization',
  profileLink: '.experts-card__button',
  appointmentButton: '.slider-experts__actions .slider__second-btn',
};
const maxCardsChecked = 8;

export default {
  id: 'doctors-homepage-block',
  title: 'Блок с врачами на главной отображается с фото, должностью, кнопка записи кликабельна',

  async run({ siteUrl, browser }) {
    const page = await newPageWithoutCaptcha(browser, { viewport: { width: 1440, height: 900 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

    const cards = page.locator(selectors.card);
    const cardCount = await cards.count();
    if (cardCount === 0) {
      return { passed: false, comment: `На главной странице не найдено ни одной карточки врача (${selectors.card}).` };
    }

    const cardTexts = await cards.evaluateAll((elements, sel) => elements.map((element) => ({
      name: (element.querySelector(sel.name)?.textContent || '').replace(/\s+/g, ' ').trim(),
      photoSrc: element.querySelector(sel.photo)?.getAttribute('src') || '',
      about: [...element.querySelectorAll(sel.about)].map((part) => part.textContent.replace(/\s+/g, ' ').trim()).join(' ').trim(),
      profileHref: element.querySelector(sel.profileLink)?.getAttribute('href') || '',
    })), selectors);
    const checkedCards = cardTexts.slice(0, maxCardsChecked);

    const photoUrls = checkedCards.filter((card) => card.photoSrc).map((card) => new URL(card.photoSrc, siteUrl).href);
    const photoStatuses = await getStatuses(photoUrls);

    const problems = [];
    checkedCards.forEach((card, index) => {
      const name = card.name || `№${index + 1}`;

      if (!card.photoSrc) {
        problems.push(`«${name}»: у фото нет src`);
      } else {
        const { status, error } = photoStatuses.get(new URL(card.photoSrc, siteUrl).href);
        if (error) problems.push(`«${name}»: фото не загрузилось (${error})`);
        else if (status < 200 || status >= 400) problems.push(`«${name}»: фото не загрузилось (HTTP ${status})`);
      }

      if (!card.about) problems.push(`«${name}»: не указана должность/специализация`);
      if (!card.profileHref) problems.push(`«${name}»: нет ссылки на страницу врача`);
    });

    const appointmentButton = page.locator(selectors.appointmentButton).first();
    await page.locator(selectors.block).first().scrollIntoViewIfNeeded();
    if (await appointmentButton.count() === 0) {
      problems.push('в блоке врачей нет кнопки «Записаться на прием»');
    } else if (!(await appointmentButton.isVisible()) || !(await appointmentButton.isEnabled())) {
      problems.push('кнопка «Записаться на прием» в блоке врачей не кликабельна');
    }
    const media = [await takeScreenshot(page)];

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${checkedCards.length} из ${cardCount} карточек врачей: фото загружаются, должность указана, ссылка на страницу врача есть, кнопка записи в блоке кликабельна.`,
        media,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media };
  },
};
