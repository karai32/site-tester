// В блоке преимуществ и лицензий на главной у карточек есть текст и иконки загрузились
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  section: '.h-main-licenses',
  card: '.h-license-card',
  icon: '.h-license-img-wrap img',
  title: '.h-license-title',
};

export default {
  id: 'homepage-advantages-block',
  title: 'Блок преимуществ/лицензий на главной отображается без искажений вёрстки',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const section = page.locator(selectors.section);
    if (await section.count() === 0) {
      return { passed: false, comment: `На главной странице не найден блок ${selectors.section}.` };
    }

    const cards = page.locator(selectors.card);
    const cardCount = await cards.count();
    if (cardCount === 0) {
      return { passed: false, comment: 'В блоке преимуществ/лицензий не найдено ни одной карточки.' };
    }

    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const media = [await takeScreenshot(page)];

    const problems = [];
    for (let index = 0; index < cardCount; index += 1) {
      const card = cards.nth(index);
      const title = (await card.locator(selectors.title).first().textContent().catch(() => '') || '').trim();
      if (!title) problems.push(`карточка №${index + 1}: не заполнен текст`);

      // Картинка не загрузилась, если у неё нулевая ширина
      const iconBroken = await card.locator(selectors.icon).first().evaluate((img) => !img.complete || img.naturalWidth === 0).catch(() => true);
      if (iconBroken) problems.push(`карточка «${title || `№${index + 1}`}»: иконка не загрузилась`);
    }

    return problems.length === 0
      ? { passed: true, comment: `Проверено ${cardCount} карточек в блоке преимуществ/лицензий: текст и иконки отображаются корректно.`, media }
      : { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media };
  },
};
