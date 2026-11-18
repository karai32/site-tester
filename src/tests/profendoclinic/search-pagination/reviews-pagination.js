import { PAGE_TIMEOUT_MS, newPageWithoutCaptcha, takeScreenshot } from '../helpers.js';

const selectors = {
  card: '#result-filter .reviews-card',
  moreButton: '#load-more',
};
const waitMs = 15_000;

function collectReviews(page) {
  return page.locator(selectors.card).evaluateAll((cards) => cards.map((card) => {
    const text = (selector) => (card.querySelector(selector)?.textContent || '').replace(/\s+/g, ' ').trim();
    return `${text('.reviews-card__name')} | ${text('.reviews-card__date')} | ${text('.reviews-card__excerpt').slice(0, 80)}`;
  }));
}

export default {
  id: 'reviews-pagination',
  title: 'Список отзывов с пагинацией отображается корректно',

  async run({ siteUrl, browser }) {
    const listUrl = new URL('/reviews/', siteUrl).href;
    const pages = [listUrl];
    const page = await newPageWithoutCaptcha(browser, { viewport: { width: 1440, height: 900 } });
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await page.waitForLoadState('load', { timeout: waitMs }).catch(() => {});

    const before = await collectReviews(page);
    if (before.length === 0) {
      return { passed: false, comment: `На странице ${listUrl} не найдено ни одного отзыва.`, media: [await takeScreenshot(page)], pages };
    }

    const moreButton = page.locator(selectors.moreButton).first();
    if (!(await moreButton.isVisible())) {
      return {
        passed: false,
        comment: `На странице отзывов не найдена кнопка «Показать еще» (${selectors.moreButton}), выведено ${before.length} отзывов.`,
        media: [await takeScreenshot(page)],
        pages,
      };
    }

    await moreButton.click();
    await page.waitForFunction(
      ([selector, count]) => document.querySelectorAll(selector).length > count,
      [selectors.card, before.length],
      { timeout: waitMs },
    ).catch(() => {});

    const after = await collectReviews(page);
    await page.locator(selectors.card).last().scrollIntoViewIfNeeded().catch(() => {});
    const media = [await takeScreenshot(page)];

    if (after.length <= before.length) {
      return {
        passed: false,
        comment: `После клика «Показать еще» новые отзывы не появились за ${waitMs / 1000} секунд (в списке по-прежнему ${after.length}).`,
        media,
        pages,
      };
    }

    const newReviews = after.filter((review) => !before.includes(review));
    if (newReviews.length === 0 || new Set(after).size < after.length) {
      return {
        passed: false,
        comment: `После клика «Показать еще» в списке появились повторы (было ${before.length}, стало ${after.length}, новых: ${newReviews.length}).`,
        media,
        pages,
      };
    }

    return {
      passed: true,
      comment: `Список отзывов пополнился после «Показать еще» (было ${before.length}, стало ${after.length}, новых: ${newReviews.length}).`,
      media,
      pages,
    };
  },
};
