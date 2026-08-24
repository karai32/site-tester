import { chromium } from '@playwright/test';

const selectors = {
  newsItem: '.news-item',
  newsDate: '.news-item [class*="date"]',
  newsLink: '.news-item__img',
};

function parseRuDate(text) {
  const match = text.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

export const newsFeedHomepage = {
  id: 'news-feed-homepage',
  title: 'Лента новостей на главной отображает актуальные даты и кликабельна',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const itemCount = await page.locator(selectors.newsItem).count();
      if (itemCount === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: 'На главной странице не найдено ни одной новости.', pageUrl: url };
      }

      const dateTexts = await page.locator(selectors.newsDate).evaluateAll((els) => els.map((el) => el.textContent.trim()));
      const dates = dateTexts.map(parseRuDate);

      if (dates.some((value) => value === null)) {
        return { id: this.id, title: this.title, status: 'failed', message: `Не удалось распознать одну из дат новостей: ${JSON.stringify(dateTexts)}.`, pageUrl: url };
      }

      const isSortedDescending = dates.every((value, index) => index === 0 || dates[index - 1] >= value);
      if (!isSortedDescending) {
        return { id: this.id, title: this.title, status: 'failed', message: `Новости отсортированы некорректно: ${dateTexts.join(', ')}.`, pageUrl: url };
      }

      const firstLink = await page.locator(selectors.newsLink).first().getAttribute('href');
      if (!firstLink) {
        return { id: this.id, title: this.title, status: 'failed', message: 'Не удалось найти ссылку на первую новость.', pageUrl: url };
      }

      await page.goto(firstLink, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const articleTextLength = await page.evaluate(() => document.body.innerText.length);
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      if (articleTextLength < 200) {
        return {
          id: this.id,
          title: this.title,
          status: 'failed',
          message: `Клик по новости открыл страницу ${firstLink}, но текста слишком мало (${articleTextLength} символов).`,
          screenshot,
          pageUrls: [url, firstLink],
        };
      }

      return {
        id: this.id,
        title: this.title,
        status: 'passed',
        message: `Новости отсортированы по дате (свежие сверху: ${dateTexts.join(', ')}), клик открывает полный текст новости.`,
        screenshot,
        pageUrls: [url, firstLink],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}`, pageUrl: url };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
