import { chromium } from '@playwright/test';
import { fetchPagesContent } from '../../site-crawler.js';

function getRobotsMetaContent(html) {
  const forward = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  if (forward) return forward[1].trim();
  const backward = html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["']/i);
  return backward ? backward[1].trim() : null;
}

export const robotsMeta = {
  id: 'robots-meta',
  title: 'Meta robots присутствует и не содержит случайного noindex на всех страницах сайта',

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

        const content = getRobotsMetaContent(html);

        if (content === null) {
          problems.push(`${pageUrl}: тег meta robots отсутствует`);
        } else if (/noindex/i.test(content)) {
          problems.push(`${pageUrl}: meta robots содержит noindex ("${content}")`);
        }
      }

      const truncatedNote = pagesTruncated ? ' Внимание: список страниц обрезан предохранителем обхода, реальных страниц может быть больше.' : '';

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${checkedCount} страниц (по общему списку страниц сайта, ${pages.length} шт.), meta robots в порядке.${truncatedNote}` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${checkedCount} страниц.${truncatedNote}`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
