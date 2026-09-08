import { chromium } from '@playwright/test';
import { fetchPagesContent } from '../../site-crawler.js';

const requiredOgTags = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];

function getOgTagContent(html, property) {
  const forward = html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'));
  if (forward) return forward[1].trim();
  const backward = html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, 'i'));
  return backward ? backward[1].trim() : null;
}

export const openGraph = {
  id: 'open-graph',
  title: 'Open Graph теги (title, description, image, url, type) присутствуют на всех страницах сайта',

  async run({ url, pages, pagesTruncated, pagesError }) {
    if (pagesError) {
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: не удалось получить список страниц сайта (${pagesError})` };
    }

    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext();

      const problems = [];
      let checkedCount = 0;

      for await (const [pageUrl, { html }] of fetchPagesContent(context.request, pages)) {
        if (!html) continue;
        checkedCount += 1;

        const missing = requiredOgTags.filter((tag) => !getOgTagContent(html, tag));
        if (missing.length > 0) {
          problems.push(`${pageUrl}: отсутствуют теги ${missing.join(', ')}`);
        }
      }

      const truncatedNote = pagesTruncated ? ' Внимание: список страниц обрезан предохранителем обхода, реальных страниц может быть больше.' : '';

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${checkedCount} страниц (по общему списку страниц сайта, ${pages.length} шт.), Open Graph теги заполнены везде.${truncatedNote}` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${checkedCount} страниц.${truncatedNote}`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
