import { chromium } from '@playwright/test';
import { captureScreenshot, errorMessage } from '../general.js';

const selectors = {
  secondPageLink: '.paginations a',
  itemTitle: 'h1',
};
const switchTimeoutMs = 15_000;

// Ключ карточки: ссылка, data-href (видео открываются в модалке) или начало текста (отзывы без ссылок).
async function collectItemKeys(page, itemSelector) {
  const keys = await page.locator(itemSelector).evaluateAll((els) => els.map((el) => el.href
    || el.dataset.href
    || el.textContent.replace(/\s+/g, ' ').trim().slice(0, 150)));
  return [...new Set(keys.filter(Boolean))];
}

/**
 * Проверка разводящей с нумерованной пагинацией: клик по странице 2 меняет список,
 * а если карточки ведут на отдельные страницы — подгруженная карточка открывается.
 *
 * @param {object} config
 * @param {string} config.id
 * @param {string} config.title
 * @param {string} config.path          Путь разводящей, например '/gallery/'.
 * @param {string} config.itemSelector  Карточка списка или ссылка карточки.
 * @param {string} config.itemsLabel    Название элементов в родительном падеже («статей», «отзывов»).
 * @param {boolean} [config.opensItem]  Карточки — ссылки на отдельные страницы, которые нужно открыть.
 */
export function createArchivePagination({ id, title, path, itemSelector, itemsLabel, opensItem = false }) {
  return {
    id,
    title,

    async run({ url }) {
      let browser;
      const listUrl = new URL(path, url).href;

      try {
        browser = await chromium.launch();
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        const page1 = await collectItemKeys(page, itemSelector);

        if (page1.length === 0) {
          return { id: this.id, title: this.title, status: 'failed', message: `На разводящей ${listUrl} не найдено ни одной карточки ${itemsLabel} (${itemSelector}).`, screenshot: await captureScreenshot(page), pageUrls: [listUrl] };
        }

        const secondPageLink = page.locator(selectors.secondPageLink, { hasText: /^\s*2\s*$/ }).first();
        if (await secondPageLink.count() === 0) {
          return { id: this.id, title: this.title, status: 'failed', message: `На разводящей ${listUrl} не найдена ссылка на страницу 2 в пагинации (${selectors.secondPageLink}), выведено ${page1.length} ${itemsLabel}.`, screenshot: await captureScreenshot(page), pageUrls: [listUrl] };
        }

        // Страница 2 может открываться переходом по ссылке или подгружаться скриптом без перехода,
        // поэтому ждём не навигацию, а смену набора карточек.
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
        const screenshot = await captureScreenshot(page);
        const pageUrls = page2Url === listUrl ? [listUrl] : [listUrl, page2Url];

        if (page2.length === 0) {
          return { id: this.id, title: this.title, status: 'failed', message: `После перехода на страницу 2 список ${itemsLabel} пуст.`, screenshot, pageUrls };
        }

        const newItems = page2.filter((key) => !page1.includes(key));
        if (newItems.length === 0) {
          return { id: this.id, title: this.title, status: 'failed', message: `После перехода на страницу 2 список ${itemsLabel} не изменился за ${switchTimeoutMs / 1000} секунд (на странице 1 — ${page1.length}, на странице 2 — ${page2.length}, новых нет).`, screenshot, pageUrls };
        }

        const listSummary = `Страница 2 показывает новый набор ${itemsLabel} (на странице 1 — ${page1.length}, на странице 2 — ${page2.length}, новых — ${newItems.length})`;

        if (!opensItem) {
          return { id: this.id, title: this.title, status: 'passed', message: `${listSummary}.`, screenshot, pageUrls };
        }

        const itemUrl = newItems[0];
        const itemResponse = await page.goto(itemUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        const itemStatus = itemResponse?.status() ?? 0;

        if (itemStatus < 200 || itemStatus >= 400) {
          return { id: this.id, title: this.title, status: 'failed', message: `${listSummary}, но карточка со страницы 2 ${itemUrl} открывается с ошибкой HTTP ${itemStatus}.`, screenshot, pageUrls: [...pageUrls, itemUrl] };
        }

        const itemTitle = (await page.locator(selectors.itemTitle).first().textContent().catch(() => '') ?? '').replace(/\s+/g, ' ').trim();
        if (!itemTitle) {
          return { id: this.id, title: this.title, status: 'failed', message: `${listSummary}, но на странице карточки ${itemUrl} нет заголовка H1.`, screenshot, pageUrls: [...pageUrls, itemUrl] };
        }

        return {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: `${listSummary}, карточка «${itemTitle}» со страницы 2 открывается корректно.`,
          screenshot,
          pageUrls: [...pageUrls, itemUrl],
        };
      } catch (error) {
        return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${errorMessage(error)}`, pageUrls: [listUrl] };
      } finally {
        await browser?.close().catch(() => {});
      }
    },
  };
}
