// Кнопка «Показать еще» на странице новостей подгружает новые новости, новость открывается
import { errorMessage, takeScreenshot } from '../helpers/common.js';

const selectors = {
  newsItem: '.news-item',
  newsLink: '.news-item__img',
  showMore: '.showmore',
  articleContent: 'main.news-single',
  articleTitle: 'main.news-single h1',
};

export default {
  id: 'news-pagination',
  title: 'Список новостей с пагинацией отображается и открывается корректно',

  async run({ siteUrl, browser }) {
    const newsUrl = new URL('/news/', siteUrl).href;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(newsUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const countBefore = await page.locator(selectors.newsItem).count();
    const hrefsBefore = new Set(await page.locator(selectors.newsLink).evaluateAll((els) => els.map((el) => el.href)));

    if (await page.locator(selectors.showMore).count() === 0) {
      return {
        passed: false,
        comment: `На странице новостей не найдена кнопка «Показать еще» (${selectors.showMore}), выведено ${countBefore} новостей.`,
        media: [await takeScreenshot(page)],
        pages: [newsUrl],
      };
    }

    // Ошибки скриптов слушаем только с этого момента, чтобы не приписать кнопке
    // посторонние ошибки сайта при загрузке страницы (например, Firebase)
    const scriptErrors = [];
    page.on('pageerror', (error) => scriptErrors.push(errorMessage(error)));

    // Кнопка отправляет POST на admin-ajax.php с действием load_more_news
    const [loadMoreResponse] = await Promise.all([
      page.waitForResponse((response) => {
        const request = response.request();
        const body = request.postData();
        return response.url().includes('admin-ajax.php') && request.method() === 'POST'
          && (body === null || body.includes('load_more_news'));
      }, { timeout: 15_000 }).catch(() => null),
      page.evaluate((selector) => document.querySelector(selector)?.click(), selectors.showMore),
    ]);
    await page.waitForTimeout(500);

    const countAfter = await page.locator(selectors.newsItem).count();
    const newHrefs = [...new Set(await page.locator(selectors.newsLink).evaluateAll((els) => els.map((el) => el.href)))]
      .filter((href) => !hrefsBefore.has(href));
    const media = [await takeScreenshot(page)];
    const pages = [newsUrl];

    if (!loadMoreResponse) {
      return {
        passed: false,
        comment: 'После клика «Показать еще» запрос на подгрузку новостей не отправился или не получил ответа за 15 секунд.',
        media,
        pages,
      };
    }
    if (!loadMoreResponse.ok()) {
      return {
        passed: false,
        comment: `Запрос подгрузки новостей вернул ошибку HTTP ${loadMoreResponse.status()}.`,
        media,
        pages,
      };
    }
    if (scriptErrors.length > 0) {
      return {
        passed: false,
        comment: `Кнопка «Показать еще» вызывает ошибку скрипта: ${scriptErrors[0]}`,
        media,
        pages,
      };
    }
    if (countAfter <= countBefore) {
      return {
        passed: false,
        comment: `После клика «Показать еще» список новостей не пополнился (было ${countBefore}, стало ${countAfter}).`,
        media,
        pages,
      };
    }
    if (newHrefs.length === 0) {
      return {
        passed: false,
        comment: `После клика «Показать еще» добавились только повторы уже показанных новостей (было ${countBefore}, стало ${countAfter}).`,
        media,
        pages,
      };
    }

    // Открываем первую подгруженную новость
    const articleUrl = newHrefs[0];
    pages.push(articleUrl);
    const articleResponse = await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const articleStatus = articleResponse?.status() ?? 0;
    if (articleStatus < 200 || articleStatus >= 400) {
      return {
        passed: false,
        comment: `Подгруженная новость ${articleUrl} открывается с ошибкой HTTP ${articleStatus}.`,
        media,
        pages,
      };
    }

    const articleTitle = (await page.locator(selectors.articleTitle).first().textContent().catch(() => '') ?? '').trim();
    const articleTextLength = await page.locator(selectors.articleContent).first()
      .evaluate((el) => el.innerText.length).catch(() => 0);

    if (!articleTitle || articleTextLength < 200) {
      const reason = articleTitle ? `содержит слишком мало текста (${articleTextLength} символов)` : 'на ней нет заголовка H1';
      return {
        passed: false,
        comment: `Подгруженная новость ${articleUrl} открылась, но ${reason}.`,
        media,
        pages,
      };
    }

    return {
      passed: true,
      comment: `Список новостей пополнился после «Показать еще» (было ${countBefore}, стало ${countAfter}, новых: ${newHrefs.length}), подгруженная новость «${articleTitle}» открывается с полным текстом (${articleTextLength} символов).`,
      media,
      pages,
    };
  },
};
