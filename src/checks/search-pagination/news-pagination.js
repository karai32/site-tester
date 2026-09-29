import { chromium } from '@playwright/test';

const selectors = {
  newsItem: '.news-item',
  newsLink: '.news-item__img',
  showMore: '.showmore',
  articleContent: 'main.news-single',
  articleTitle: 'main.news-single h1',
};

export const newsPagination = {
  id: 'news-pagination',
  title: 'Список новостей с пагинацией отображается и открывается корректно',

  async run({ url }) {
    let browser;
    const consoleErrors = [];
    const newsUrl = new URL('/news/', url).href;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

      await page.goto(newsUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const countBefore = await page.locator(selectors.newsItem).count();
      const hrefsBefore = new Set(await page.locator(selectors.newsLink).evaluateAll((els) => els.map((el) => el.href)));

      if (await page.locator(selectors.showMore).count() === 0) {
        await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
        const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
        const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
        return { id: this.id, title: this.title, status: 'failed', message: `На странице новостей не найдена кнопка «Показать еще» (${selectors.showMore}), выведено ${countBefore} новостей.`, screenshot, pageUrls: [newsUrl] };
      }

      // Attached only now (not from page load) so pre-existing, unrelated site-wide script
      // errors (e.g. Firebase messaging) aren't misattributed to the "Показать еще" click.
      page.on('pageerror', (error) => consoleErrors.push(error.message.split('\n')[0]));
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
      await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      if (!loadMoreResponse) {
        return { id: this.id, title: this.title, status: 'failed', message: 'После клика «Показать еще» запрос на подгрузку новостей не отправился или не получил ответа за 15 секунд.', screenshot, pageUrls: [newsUrl] };
      }

      if (!loadMoreResponse.ok()) {
        return { id: this.id, title: this.title, status: 'failed', message: `Запрос подгрузки новостей вернул ошибку HTTP ${loadMoreResponse.status()}.`, screenshot, pageUrls: [newsUrl] };
      }

      if (consoleErrors.length > 0) {
        return {
          id: this.id,
          title: this.title,
          status: 'failed',
          message: `Кнопка «Показать еще» вызывает ошибку скрипта: ${consoleErrors[0]}`,
          screenshot,
          pageUrls: [newsUrl],
        };
      }

      if (countAfter <= countBefore) {
        return {
          id: this.id,
          title: this.title,
          status: 'failed',
          message: `После клика «Показать еще» список новостей не пополнился (было ${countBefore}, стало ${countAfter}).`,
          screenshot,
          pageUrls: [newsUrl],
        };
      }

      if (newHrefs.length === 0) {
        return {
          id: this.id,
          title: this.title,
          status: 'failed',
          message: `После клика «Показать еще» добавились только повторы уже показанных новостей (было ${countBefore}, стало ${countAfter}).`,
          screenshot,
          pageUrls: [newsUrl],
        };
      }

      const articleUrl = newHrefs[0];
      const articleResponse = await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const articleStatus = articleResponse?.status() ?? 0;

      if (articleStatus < 200 || articleStatus >= 400) {
        return { id: this.id, title: this.title, status: 'failed', message: `Подгруженная новость ${articleUrl} открывается с ошибкой HTTP ${articleStatus}.`, screenshot, pageUrls: [newsUrl, articleUrl] };
      }

      const articleTitle = (await page.locator(selectors.articleTitle).first().textContent().catch(() => '') ?? '').trim();
      const articleTextLength = await page.locator(selectors.articleContent).first()
        .evaluate((el) => el.innerText.length).catch(() => 0);

      if (!articleTitle || articleTextLength < 200) {
        return {
          id: this.id,
          title: this.title,
          status: 'failed',
          message: `Подгруженная новость ${articleUrl} открылась, но ${articleTitle ? `содержит слишком мало текста (${articleTextLength} символов)` : 'на ней нет заголовка H1'}.`,
          screenshot,
          pageUrls: [newsUrl, articleUrl],
        };
      }

      return {
        id: this.id,
        title: this.title,
        status: 'passed',
        message: `Список новостей пополнился после «Показать еще» (было ${countBefore}, стало ${countAfter}, новых — ${newHrefs.length}), подгруженная новость «${articleTitle}» открывается с полным текстом (${articleTextLength} символов).`,
        screenshot,
        pageUrls: [newsUrl, articleUrl],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}`, pageUrls: [newsUrl] };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
