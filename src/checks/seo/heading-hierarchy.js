import { chromium } from '@playwright/test';
import { fetchPagesContent } from '../../site-crawler.js';

export const headingHierarchy = {
  id: 'heading-hierarchy',
  title: 'Иерархия заголовков не нарушена (ровно один H1, без пропуска уровней) на всех страницах сайта',

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

        const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
        const h1Count = levels.filter((level) => level === 1).length;

        if (h1Count !== 1) {
          problems.push(`${pageUrl}: на странице ${h1Count} тегов H1 (должен быть ровно один)`);
        }

        for (let index = 1; index < levels.length; index += 1) {
          if (levels[index] - levels[index - 1] > 1) {
            problems.push(`${pageUrl}: пропуск уровня заголовка — H${levels[index - 1]} сразу сменяется H${levels[index]}`);
            break;
          }
        }
      }

      const truncatedNote = pagesTruncated ? ' Внимание: список страниц обрезан предохранителем обхода, реальных страниц может быть больше.' : '';

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${checkedCount} страниц (по общему списку страниц сайта, ${pages.length} шт.), иерархия заголовков корректна.${truncatedNote}` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${checkedCount} страниц.${truncatedNote}`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
