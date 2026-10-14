// В блоке врачей на главной у карточек есть фото, должность и рабочая кнопка записи
import { getStatuses, takeScreenshot } from '../helpers/common.js';

const selectors = {
  card: '.doctor-item',
  photo: '.doctor-item__img',
  about: '.doctor-item__about',
  appointmentButton: '.doctor-item__link',
};
const maxCardsChecked = 8;

export default {
  id: 'doctors-homepage-block',
  title: 'Блок с врачами на главной отображается с фото, должностью, кнопка записи кликабельна',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const cards = page.locator(selectors.card);
    const cardCount = await cards.count();
    if (cardCount === 0) {
      return { passed: false, comment: 'На главной странице не найдено ни одной карточки врача.' };
    }

    const problems = [];
    const checkedCount = Math.min(cardCount, maxCardsChecked);

    for (let index = 0; index < checkedCount; index += 1) {
      const card = cards.nth(index);
      const name = (await card.locator('h3').first().textContent().catch(() => '') || `№${index + 1}`).trim();

      // Фото в карусели грузятся лениво, поэтому берём src из разметки и проверяем HTTP-статус
      const photoSrc = await card.locator(selectors.photo).first().getAttribute('src').catch(() => null);
      if (!photoSrc) {
        problems.push(`«${name}»: у фото нет src`);
      } else {
        const photoUrl = new URL(photoSrc, siteUrl).href;
        const { status, error } = (await getStatuses([photoUrl])).get(photoUrl);
        if (error) problems.push(`«${name}»: фото не загрузилось (${error})`);
        else if (status < 200 || status >= 400) problems.push(`«${name}»: фото не загрузилось (HTTP ${status})`);
      }

      const aboutText = (await card.locator(selectors.about).first().textContent().catch(() => '') || '').trim();
      if (!aboutText) problems.push(`«${name}»: не указана должность/специализация`);

      const button = card.locator(selectors.appointmentButton).first();
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
