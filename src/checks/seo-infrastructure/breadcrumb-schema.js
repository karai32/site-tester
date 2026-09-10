import { chromium } from '@playwright/test';
import { fetchPagesContent } from '../../site-crawler.js';

function hasBreadcrumbSchema(html) {
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    if (/"@type"\s*:\s*"BreadcrumbList"/.test(match[1])) return true;
  }
  return false;
}

export const breadcrumbSchema = {
  id: 'breadcrumb-schema',
  title: 'Микроразметка BreadcrumbList присутствует на внутренних страницах сайта',

  async run({ url, htmlPages: pages, pagesTruncated, pagesError }) {
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
        if (pageUrl === url) continue;
        checkedCount += 1;

        if (!hasBreadcrumbSchema(html)) {
          problems.push(`${pageUrl}: микроразметка BreadcrumbList не найдена`);
        }
      }

      const truncatedNote = pagesTruncated ? ' Внимание: список страниц обрезан предохранителем обхода, реальных страниц может быть больше.' : '';

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${checkedCount} HTML-страниц сайта (без учёта главной), BreadcrumbList есть везде.${truncatedNote}` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${checkedCount} страниц.${truncatedNote}`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
