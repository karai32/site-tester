import { chromium } from '@playwright/test';
import { fetchPagesContent } from '../../site-crawler.js';

function getTitle(html) {
  return html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
}

export const titlePresent = {
  id: 'title-present',
  title: 'Title корректный (присутствует и не пуст) на всех страницах сайта',

  async run({ url, pages, pagesTruncated, pagesError }) {
    if (pagesError) {
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: не удалось получить список страниц сайта (${pagesError})` };
    }

    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext();
      const results = await fetchPagesContent(context.request, pages);

      const problems = [];
      let checkedCount = 0;

      for (const [pageUrl, { html }] of results) {
        if (!html) continue;
        checkedCount += 1;
        const title = getTitle(html);
        if (!title) {
          problems.push(`${pageUrl}: title отсутствует или пуст`);
        }
      }

      const truncatedNote = pagesTruncated ? ' Внимание: список страниц обрезан предохранителем обхода, реальных страниц может быть больше.' : '';

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${checkedCount} страниц (по общему списку страниц сайта, ${pages.length} шт.), у всех заполнен title.${truncatedNote}` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${checkedCount} страниц.${truncatedNote}`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
