import { PAGE_TIMEOUT_MS, newPageWithoutCaptcha, takeScreenshot } from '../helpers.js';

const selectors = {
  card: '#result-filter-knowledge .grid-videos__card',
  moreButton: '#load-more-knowledge',
  articleTitle: 'main .content-wrapper__title, main h1',
  articleContent: 'main',
};
const waitMs = 15_000;
const minArticleTextLength = 200;

function collectCards(page) {
  return page.locator(selectors.card).evaluateAll((cards) => cards.map((card) => {
    const title = (card.querySelector('.text-card__name, .videos-card__name')?.textContent || '').replace(/\s+/g, ' ').trim();
    const video = card.querySelector('a[data-video]');
    const link = card.querySelector('a[href]');
    return {
      key: `${title} | ${video ? video.dataset.video : link?.href || ''}`,
      articleUrl: !video && link ? link.href : null,
    };
  }));
}

export default {
  id: 'knowledge-pagination',
  title: 'База знаний с пагинацией отображается и открывается корректно',

  async run({ siteUrl, browser }) {
    const listUrl = new URL('/knowledge/', siteUrl).href;
    const pages = [listUrl];
    const page = await newPageWithoutCaptcha(browser, { viewport: { width: 1440, height: 900 } });
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await page.waitForLoadState('load', { timeout: waitMs }).catch(() => {});

    const before = await collectCards(page);
    if (before.length === 0) {
      return { passed: false, comment: `На странице ${listUrl} не найдено ни одного материала.`, media: [await takeScreenshot(page)], pages };
    }

    const moreButton = page.locator(selectors.moreButton).first();
    if (!(await moreButton.isVisible())) {
      return {
        passed: false,
        comment: `В базе знаний не найдена кнопка «Показать еще» (${selectors.moreButton}), выведено ${before.length} материалов.`,
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

    const after = await collectCards(page);
    await page.locator(selectors.card).last().scrollIntoViewIfNeeded().catch(() => {});
    const media = [await takeScreenshot(page)];

    if (after.length <= before.length) {
      return {
        passed: false,
        comment: `После клика «Показать еще» новые материалы не появились за ${waitMs / 1000} секунд (в списке по-прежнему ${after.length}).`,
        media,
        pages,
      };
    }

    const beforeKeys = before.map((card) => card.key);
    const newCards = after.filter((card) => !beforeKeys.includes(card.key));
    if (newCards.length === 0 || new Set(after.map((card) => card.key)).size < after.length) {
      return {
        passed: false,
        comment: `После клика «Показать еще» в списке появились повторы (было ${before.length}, стало ${after.length}, новых: ${newCards.length}).`,
        media,
        pages,
      };
    }

    const listSummary = `Список базы знаний пополнился после «Показать еще» (было ${before.length}, стало ${after.length}, новых: ${newCards.length})`;
    const article = newCards.find((card) => card.articleUrl) || after.find((card) => card.articleUrl);
    if (!article) {
      return { passed: true, comment: `${listSummary}. Статей в списке нет, только видео, открытие материала не проверялось.`, media, pages };
    }

    pages.push(article.articleUrl);
    const articleResponse = await page.goto(article.articleUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    const articleStatus = articleResponse?.status() ?? 0;
    if (articleStatus < 200 || articleStatus >= 400) {
      return {
        passed: false,
        comment: `${listSummary}, но материал ${article.articleUrl} открывается с ошибкой HTTP ${articleStatus}.`,
        media,
        pages,
      };
    }

    const articleTitle = await page.locator(selectors.articleTitle).first()
      .evaluate((element) => element.textContent.replace(/\s+/g, ' ').trim(), undefined, { timeout: 5_000 }).catch(() => '');
    const articleTextLength = await page.locator(selectors.articleContent).first()
      .evaluate((element) => element.innerText.length, undefined, { timeout: 5_000 }).catch(() => 0);

    if (!articleTitle || articleTextLength < minArticleTextLength) {
      const reason = articleTitle ? `содержит слишком мало текста (${articleTextLength} символов)` : 'на ней нет заголовка';
      return {
        passed: false,
        comment: `${listSummary}, но страница материала ${article.articleUrl} открылась и ${reason}.`,
        media,
        pages,
      };
    }

    return {
      passed: true,
      comment: `${listSummary}, материал «${articleTitle}» открывается с текстом (${articleTextLength} символов).`,
      media,
      pages,
    };
  },
};
