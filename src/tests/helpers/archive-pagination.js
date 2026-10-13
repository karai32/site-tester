// Общий тест для разделов-списков с нумерованной пагинацией (статьи, галерея, отзывы...).
// Каждый такой тест — файл в search-pagination, который вызывает createArchivePagination со своими настройками.
import { takeScreenshot } from './common.js';

const selectors = {
  secondPageLink: '.paginations a',
  itemTitle: 'h1',
};
const switchTimeoutMs = 15_000;

// Ключ карточки: ссылка, data-href (видео открываются в модалке) или начало текста (отзывы без ссылок)
async function collectItemKeys(page, itemSelector) {
  const keys = await page.locator(itemSelector).evaluateAll((els) => els.map((el) => el.href
    || el.dataset.href
    || el.textContent.replace(/\s+/g, ' ').trim().slice(0, 150)));
  return [...new Set(keys.filter(Boolean))];
}

/**
 * Клик по странице 2 меняет список, а если карточки ведут на отдельные страницы —
 * карточка со страницы 2 открывается.
 *
 * @param {object} config
 * @param {string} config.id
 * @param {string} config.title
 * @param {string} config.path          Путь раздела, например '/gallery/'
 * @param {string} config.itemSelector  Карточка списка или ссылка карточки
 * @param {string} config.itemsLabel    Название элементов в родительном падеже («статей», «отзывов»)
 * @param {boolean} [config.opensItem]  Карточки — ссылки на отдельные страницы, которые нужно открыть
 */
export function createArchivePagination({ id, title, path, itemSelector, itemsLabel, opensItem = false }) {
  return {
    id,
    title,

    async run({ siteUrl, browser }) {
      const listUrl = new URL(path, siteUrl).href;
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const page1 = await collectItemKeys(page, itemSelector);
      if (page1.length === 0) {
        return { passed: false, comment: `На разводящей ${listUrl} не найдено ни одной карточки ${itemsLabel} (${itemSelector}).`, media: [await takeScreenshot(page)], pages: [listUrl] };
      }

      const secondPageLink = page.locator(selectors.secondPageLink, { hasText: /^\s*2\s*$/ }).first();
      if (await secondPageLink.count() === 0) {
        return { passed: false, comment: `На разводящей ${listUrl} не найдена ссылка на страницу 2 в пагинации (${selectors.secondPageLink}), выведено ${page1.length} ${itemsLabel}.`, media: [await takeScreenshot(page)], pages: [listUrl] };
      }

      // Страница 2 может открываться переходом по ссылке или подгружаться скриптом без перехода,
      // поэтому ждём не переход, а смену набора карточек.
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
        return { passed: false, comment: `После перехода на страницу 2 список ${itemsLabel} пуст.`, media, pages };
      }

      const newItems = page2.filter((key) => !page1.includes(key));
      if (newItems.length === 0) {
        return { passed: false, comment: `После перехода на страницу 2 список ${itemsLabel} не изменился за ${switchTimeoutMs / 1000} секунд (на странице 1 — ${page1.length}, на странице 2 — ${page2.length}, новых нет).`, media, pages };
      }

      const listSummary = `Страница 2 показывает новый набор ${itemsLabel} (на странице 1 — ${page1.length}, на странице 2 — ${page2.length}, новых — ${newItems.length})`;
      if (!opensItem) {
        return { passed: true, comment: `${listSummary}.`, media, pages };
      }

      // Открываем первую новую карточку со страницы 2
      const itemUrl = newItems[0];
      pages.push(itemUrl);
      const itemResponse = await page.goto(itemUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const itemStatus = itemResponse?.status() ?? 0;
      if (itemStatus < 200 || itemStatus >= 400) {
        return { passed: false, comment: `${listSummary}, но карточка со страницы 2 ${itemUrl} открывается с ошибкой HTTP ${itemStatus}.`, media, pages };
      }

      const itemTitle = (await page.locator(selectors.itemTitle).first().textContent().catch(() => '') ?? '').replace(/\s+/g, ' ').trim();
      if (!itemTitle) {
        return { passed: false, comment: `${listSummary}, но на странице карточки ${itemUrl} нет заголовка H1.`, media, pages };
      }

      return { passed: true, comment: `${listSummary}, карточка «${itemTitle}» со страницы 2 открывается корректно.`, media, pages };
    },
  };
}
