import { chromium } from '@playwright/test';

const selectors = {
  newsItem: '.news-item',
  newsLink: '.news-item__img',
  showMore: '.showmore',
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
      const firstArticleHref = await page.locator(selectors.newsLink).first().getAttribute('href');

      // Attached only now (not from page load) so pre-existing, unrelated site-wide script
      // errors (e.g. Firebase messaging) aren't misattributed to the "Показать еще" click.
      page.on('pageerror', (error) => consoleErrors.push(error.message.split('\n')[0]));
      await page.evaluate((selector) => document.querySelector(selector)?.click(), selectors.showMore);
      await page.waitForTimeout(2_500);

      const countAfter = await page.locator(selectors.newsItem).count();
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

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

      if (!firstArticleHref) {
        return { id: this.id, title: this.title, status: 'failed', message: 'Не удалось найти ссылку на первую новость.', screenshot, pageUrls: [newsUrl] };
      }

      await page.goto(firstArticleHref, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const articleTitle = await page.title();
      const articleTextLength = await page.evaluate(() => document.body.innerText.length);

      if (articleTextLength < 200) {
        return {
          id: this.id,
          title: this.title,
          status: 'failed',
          message: `Страница новости ${firstArticleHref} открылась, но содержит слишком мало текста (${articleTextLength} символов).`,
          screenshot,
          pageUrls: [newsUrl, firstArticleHref],
        };
      }

      return {
        id: this.id,
        title: this.title,
        status: 'passed',
        message: `Список новостей пополнился после «Показать еще» (было ${countBefore}, стало ${countAfter}), новость «${articleTitle}» открывается с полным текстом.`,
        screenshot,
        pageUrls: [newsUrl, firstArticleHref],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}`, pageUrls: [newsUrl] };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
