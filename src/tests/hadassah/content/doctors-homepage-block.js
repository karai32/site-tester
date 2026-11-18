import { PAGE_TIMEOUT_MS, getStatuses, takeScreenshot } from '../helpers.js';

const selectors = {
  card: '.doctor-item',
  photo: '.doctor-item__img',
  about: '.doctor-item__credentials',
  appointmentButton: '.doctor-item__link',
};
const maxCardsChecked = 8;

export default {
  id: 'doctors-homepage-block',
  title: 'Блок с врачами на главной отображается с фото, должностью, кнопка записи кликабельна',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

    const cards = page.locator(selectors.card);
    const cardCount = await cards.count();
    if (cardCount === 0) {
      return { passed: false, comment: 'На главной странице не найдено ни одной карточки врача.' };
    }

    const problems = [];
    const checkedCount = Math.min(cardCount, maxCardsChecked);

    const cardTexts = await cards.evaluateAll((elements, sel) => elements.map((element) => ({
      name: (element.querySelector('h3')?.textContent || '').trim(),
      photoSrc: element.querySelector(sel.photo)?.getAttribute('src') || '',
      about: (element.querySelector(sel.about)?.textContent || '').trim(),
    })), selectors);
    const checkedCards = cardTexts.slice(0, checkedCount);

    const photoUrls = checkedCards.filter((card) => card.photoSrc).map((card) => new URL(card.photoSrc, siteUrl).href);
    const photoStatuses = await getStatuses(photoUrls);

    for (let index = 0; index < checkedCount; index += 1) {
      const { photoSrc, about } = checkedCards[index];
      const name = checkedCards[index].name || `№${index + 1}`;

      if (!photoSrc) {
        problems.push(`«${name}»: у фото нет src`);
      } else {
        const { status, error } = photoStatuses.get(new URL(photoSrc, siteUrl).href);
        if (error) problems.push(`«${name}»: фото не загрузилось (${error})`);
        else if (status < 200 || status >= 400) problems.push(`«${name}»: фото не загрузилось (HTTP ${status})`);
      }

      if (!about) problems.push(`«${name}»: не указана должность/специализация`);

      const button = cards.nth(index).locator(selectors.appointmentButton).first();
      if (await button.count() > 0) {
        const clickable = await button.isVisible().catch(() => false) && await button.isEnabled().catch(() => false);
        if (!clickable) problems.push(`«${name}»: кнопка записи не кликабельна`);
      }
    }

    await cards.first().scrollIntoViewIfNeeded();
    const media = [await takeScreenshot(page)];

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${checkedCount} из ${cardCount} карточек врачей: фото загружаются, должность указана, кнопка записи (где есть) кликабельна.`,
        media,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media };
  },
};
