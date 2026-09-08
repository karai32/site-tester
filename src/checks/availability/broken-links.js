import { chromium } from '@playwright/test';
import { checkPagesStatus } from '../../site-crawler.js';

const maxSourcesShown = 5;

function formatSources(sources) {
  if (sources.length === 0) return '';
  const shown = sources.slice(0, maxSourcesShown);
  const rest = sources.length - shown.length;
  return ` (найдена на: ${shown.join(', ')}${rest > 0 ? ` и ещё ${rest} стр.` : ''})`;
}

export const brokenLinks = {
  id: 'broken-links',
  title: 'Отсутствие битых ссылок',

  async run({ url, pages, pagesTruncated, pagesError, linkSources }) {
    if (pagesError) {
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: не удалось получить список страниц сайта (${pagesError})` };
    }

    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext();
      const results = await checkPagesStatus(context.request, pages);

      const problems = [];

      for (const [linkUrl, { status, error }] of results) {
        if (linkUrl === url) continue;

        const isBroken = Boolean(error) || status < 200 || status >= 400;
        if (!isBroken) continue;

        const sources = [...(linkSources?.get(linkUrl) || [])];
        const reason = error ? error : `HTTP ${status}`;
        problems.push(`${linkUrl}: ${reason}${formatSources(sources)}`);
      }

      const truncatedNote = pagesTruncated ? ' Внимание: список страниц обрезан предохранителем обхода, реальных страниц может быть больше.' : '';

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${results.size} внутренних ссылок (страниц и файлов), битых ссылок не найдено.${truncatedNote}` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${results.size} ссылок.${truncatedNote}`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
