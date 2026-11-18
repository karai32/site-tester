import { PAGE_TIMEOUT_MS, newPageWithoutCaptcha, takeScreenshot } from '../helpers.js';

const queries = [
  { text: '', label: 'Пустой запрос' },
  { text: 'asdkjhqwe123zzz', label: 'Бессмысленный запрос' },
];
const selectors = {
  loading: '#global-search-results .search-loading',
  count: '#global-search-results .search-results-count',
  group: '#global-search-results .search-results-group',
  message: '#global-search-results .no-results, #global-search-results .search-results__placeholder',
};
const searchTimeoutMs = 20_000;

export default {
  id: 'search-no-results',
  title: 'Поиск по пустому/бессмысленному запросу показывает понятное сообщение вместо результатов',

  async run({ siteUrl, browser }) {
    const page = await newPageWithoutCaptcha(browser, { viewport: { width: 1440, height: 900 } });
    const problems = [];
    const messages = [];
    const media = [];
    const pages = [];

    for (const query of queries) {
      const searchUrl = `${new URL('/poisk/', siteUrl).href}?q=${encodeURIComponent(query.text)}`;
      pages.push(searchUrl);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
      await page.waitForFunction((sel) => !document.querySelector(sel.loading)
        && Boolean(document.querySelector(sel.count) || document.querySelector(sel.message)), selectors, { timeout: searchTimeoutMs }).catch(() => {});

      const shown = await page.evaluate((sel) => ({
        message: (document.querySelector(sel.message)?.textContent || '').replace(/\s+/g, ' ').trim(),
        groups: document.querySelectorAll(sel.group).length,
        countText: (document.querySelector(sel.count)?.textContent || '').replace(/\s+/g, ' ').trim(),
      }), selectors);
      media.push({ data: await takeScreenshot(page), caption: query.label });

      if (shown.groups > 0) {
        problems.push(`${query.label} (${searchUrl}): вместо сообщения показаны результаты (${shown.countText})`);
      } else if (!shown.message) {
        problems.push(`${query.label} (${searchUrl}): нет ни результатов, ни сообщения о том, что ничего не найдено`);
      } else {
        messages.push(`${query.label}: «${shown.message.slice(0, 90)}»`);
      }
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `По пустому и по бессмысленному запросу показывается сообщение. ${messages.join('. ')}.`,
        media,
        pages,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media, pages };
  },
};
