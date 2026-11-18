import { PAGE_TIMEOUT_MS, newPageWithoutCaptcha, takeScreenshot } from '../helpers.js';

const query = 'диабет';
const selectors = {
  count: '#global-search-results .search-results-count',
  group: '#global-search-results .search-results-group',
};
const searchTimeoutMs = 20_000;

export default {
  id: 'search-results',
  title: 'Поиск по сайту возвращает релевантные результаты по запросу',

  async run({ siteUrl, browser }) {
    const searchUrl = `${new URL('/poisk/', siteUrl).href}?q=${encodeURIComponent(query)}`;
    const page = await newPageWithoutCaptcha(browser, { viewport: { width: 1440, height: 900 } });
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await page.locator(selectors.count).first().waitFor({ state: 'attached', timeout: searchTimeoutMs }).catch(() => {});

    const found = await page.evaluate((sel) => ({
      countText: (document.querySelector(sel.count)?.textContent || '').replace(/\s+/g, ' ').trim(),
      groups: document.querySelectorAll(sel.group).length,
    }), selectors);
    const media = [await takeScreenshot(page)];
    const pages = [searchUrl];

    const resultCount = Number(found.countText.match(/^(\d+)\s*результ/i)?.[1] || 0);
    if (resultCount > 0 && found.groups > 0) {
      return {
        passed: true,
        comment: `По запросу «${query}» найдено: ${found.countText}.`,
        media,
        pages,
      };
    }
    return {
      passed: false,
      comment: `По запросу «${query}» на странице ${searchUrl} не найдено результатов (ожидались релевантные страницы).`,
      media,
      pages,
    };
  },
};
