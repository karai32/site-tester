import { request } from 'playwright';
import { PAGE_TIMEOUT_MS, PARALLEL_REQUESTS, REQUEST_TIMEOUT_MS } from '../../config.js';

export { PAGE_TIMEOUT_MS };

export function errorMessage(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

export async function takeScreenshot(page, { fullPage = false } = {}) {
  await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
  return page.screenshot({ type: 'jpeg', quality: fullPage ? 45 : 60, fullPage });
}

export async function getStatuses(urls) {
  const results = new Map();
  const queue = [...urls];
  const api = await request.newContext();

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      try {
        const head = await api.head(url, { failOnStatusCode: false, timeout: REQUEST_TIMEOUT_MS });
        let status = head.status();
        await head.dispose();

        if (status === 405 || status === 501) {
          const get = await api.get(url, { failOnStatusCode: false, timeout: REQUEST_TIMEOUT_MS });
          status = get.status();
          await get.dispose();
        }
        results.set(url, { status, error: null });
      } catch (error) {
        results.set(url, { status: 0, error: errorMessage(error) });
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, worker));
  } finally {
    await api.dispose();
  }

  return results;
}

const selectors = {
  secondPageLink: '.paginations a',
  itemTitle: 'h1',
};
const switchTimeoutMs = 15_000;

async function collectItemKeys(page, itemSelector) {
  const keys = await page.locator(itemSelector).evaluateAll((els) => els.map((el) => el.href
    || el.dataset.href
    || el.textContent.replace(/\s+/g, ' ').trim().slice(0, 150)));
  return [...new Set(keys.filter(Boolean))];
}

export function createArchivePagination({ id, title, path, itemSelector, itemsLabel, opensItem = false }) {
  return {
    id,
    title,

    async run({ siteUrl, browser }) {
      const listUrl = new URL(path, siteUrl).href;
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

      const page1 = await collectItemKeys(page, itemSelector);
      if (page1.length === 0) {
        return {
          passed: false,
          comment: `На разводящей ${listUrl} не найдено ни одной карточки ${itemsLabel} (${itemSelector}).`,
          media: [await takeScreenshot(page)],
          pages: [listUrl],
        };
      }

      const secondPageLink = page.locator(selectors.secondPageLink, { hasText: /^\s*2\s*$/ }).first();
      if (await secondPageLink.count() === 0) {
        return {
          passed: false,
          comment: `На разводящей ${listUrl} не найдена ссылка на страницу 2 в пагинации (${selectors.secondPageLink}), выведено ${page1.length} ${itemsLabel}.`,
          media: [await takeScreenshot(page)],
          pages: [listUrl],
        };
      }

      await secondPageLink.evaluate((el) => el.click());
      let page2 = [];
      const deadline = Date.now() + switchTimeoutMs;
      while (Date.now() < deadline) {
        await page.waitForTimeout(500);
        page2 = await collectItemKeys(page, itemSelector).catch(() => []);
        if (page2.some((key) => !page1.includes(key))) break;
      }
      await page.waitForLoadState('domcontentloaded').catch(() => {});

      const page2Url = page.url();
      const media = [await takeScreenshot(page)];
      const pages = page2Url === listUrl ? [listUrl] : [listUrl, page2Url];

      if (page2.length === 0) {
        return {
          passed: false,
          comment: `После перехода на страницу 2 список ${itemsLabel} пуст.`,
          media,
          pages,
        };
      }

      const newItems = page2.filter((key) => !page1.includes(key));
      if (newItems.length === 0) {
        return {
          passed: false,
          comment: `После перехода на страницу 2 список ${itemsLabel} не изменился за ${switchTimeoutMs / 1000} секунд (на странице 1: ${page1.length}, на странице 2: ${page2.length}, новых нет).`,
          media,
          pages,
        };
      }

      const listSummary = `Страница 2 показывает новый набор ${itemsLabel} (на странице 1: ${page1.length}, на странице 2: ${page2.length}, новых: ${newItems.length})`;
      if (!opensItem) {
        return { passed: true, comment: `${listSummary}.`, media, pages };
      }

      const itemUrl = newItems[0];
      pages.push(itemUrl);
      const itemResponse = await page.goto(itemUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
      const itemStatus = itemResponse?.status() ?? 0;
      if (itemStatus < 200 || itemStatus >= 400) {
        return {
          passed: false,
          comment: `${listSummary}, но карточка со страницы 2 ${itemUrl} открывается с ошибкой HTTP ${itemStatus}.`,
          media,
          pages,
        };
      }

      const itemTitle = (await page.locator(selectors.itemTitle).first().textContent().catch(() => '') ?? '').replace(/\s+/g, ' ').trim();
      if (!itemTitle) {
        return {
          passed: false,
          comment: `${listSummary}, но на странице карточки ${itemUrl} нет заголовка H1.`,
          media,
          pages,
        };
      }

      return {
        passed: true,
        comment: `${listSummary}, карточка «${itemTitle}» со страницы 2 открывается корректно.`,
        media,
        pages,
      };
    },
  };
}

function countTags(text, tag) {
  const matches = text.match(new RegExp(`<${tag}[\\s>]`, 'g'));
  if (!matches) return 0;
  return matches.length;
}

export async function checkFeed({ siteUrl, browser }, feed) {
  const url = new URL(feed.path, siteUrl).href;
  const page = await browser.newPage();

  const response = await page.request.get(url, { failOnStatusCode: false, timeout: 60_000 });
  const status = response.status();
  const contentType = response.headers()['content-type'] || '';
  let text = '';
  if (status === 200) text = await response.text();
  await response.dispose();

  let problem = null;
  if (status !== 200) {
    problem = `Фид недоступен: HTTP ${status}`;
  } else if (!contentType.includes('xml')) {
    problem = `Фид отдаётся не как XML (content-type: ${contentType})`;
  } else if (countTags(text, feed.rootTag) === 0) {
    problem = `В фиде нет главного тега <${feed.rootTag}>`;
  } else if (countTags(text, feed.itemTag) === 0) {
    problem = `В фиде нет ни одной записи <${feed.itemTag}>`;
  }

  if (problem) {
    return {
      passed: false,
      comment: problem,
      problems: [problem],
      pages: [url],
    };
  }

  return {
    passed: true,
    comment: `Фид открывается, ${feed.itemsTitle}: ${countTags(text, feed.itemTag)}.`,
    pages: [url],
  };
}
