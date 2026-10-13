// Новости на главной идут от свежих к старым, первая новость открывается
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  newsItem: '.news-item',
  newsDate: '.news-item [class*="date"]',
  newsLink: '.news-item__img',
};

// "10.09.2026" → число для сравнения дат, или null
function parseRuDate(text) {
  const match = text.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

export default {
  id: 'news-feed-homepage',
  title: 'Лента новостей на главной отображает актуальные даты и кликабельна',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    if (await page.locator(selectors.newsItem).count() === 0) {
      return { passed: false, comment: 'На главной странице не найдено ни одной новости.' };
    }

    const dateTexts = await page.locator(selectors.newsDate).evaluateAll((els) => els.map((el) => el.textContent.trim()));
    const dates = dateTexts.map(parseRuDate);
    if (dates.some((value) => value === null)) {
      return { passed: false, comment: `Не удалось распознать одну из дат новостей: ${JSON.stringify(dateTexts)}.` };
    }

    const isSortedDescending = dates.every((value, index) => index === 0 || dates[index - 1] >= value);
    if (!isSortedDescending) {
      return { passed: false, comment: `Новости отсортированы некорректно: ${dateTexts.join(', ')}.` };
    }

    const firstLink = await page.locator(selectors.newsLink).first().getAttribute('href');
    if (!firstLink) {
      return { passed: false, comment: 'Не удалось найти ссылку на первую новость.' };
    }

    await page.goto(firstLink, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const articleTextLength = await page.evaluate(() => document.body.innerText.length);
    const media = [await takeScreenshot(page)];
    const pages = [siteUrl, firstLink];

    return articleTextLength >= 200
      ? { passed: true, comment: `Новости отсортированы по дате (свежие сверху: ${dateTexts.join(', ')}), клик открывает полный текст новости.`, media, pages }
      : { passed: false, comment: `Клик по новости открыл страницу ${firstLink}, но текста слишком мало (${articleTextLength} символов).`, media, pages };
  },
};
