import { chromium } from '@playwright/test';
import { fetchPagesContent } from '../general.js';

function getCanonicalHrefs(html) {
  const hrefs = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/rel=["']canonical["']/i.test(tag)) continue;
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (hrefMatch) hrefs.push(hrefMatch[1].trim());
  }
  return hrefs;
}

export const canonicalUrls = {
  id: 'canonical-urls',
  title: 'Canonical URL указан ровно один раз и является корректной абсолютной ссылкой на всех страницах сайта',

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
        checkedCount += 1;

        const canonicalHrefs = getCanonicalHrefs(html);

        if (canonicalHrefs.length === 0) {
          problems.push(`${pageUrl}: тег canonical отсутствует`);
        } else if (canonicalHrefs.length > 1) {
          problems.push(`${pageUrl}: найдено ${canonicalHrefs.length} тегов canonical (${canonicalHrefs.join(', ')})`);
        } else {
          try {
            const parsed = new URL(canonicalHrefs[0]);
            if (!/^https?:$/.test(parsed.protocol)) {
              problems.push(`${pageUrl}: canonical "${canonicalHrefs[0]}" не является корректной абсолютной ссылкой`);
            }
          } catch {
            problems.push(`${pageUrl}: canonical "${canonicalHrefs[0]}" не является корректной абсолютной ссылкой`);
          }
        }
      }

      const truncatedNote = pagesTruncated ? ' Внимание: список страниц обрезан предохранителем обхода, реальных страниц может быть больше.' : '';

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${checkedCount} HTML-страниц сайта, у всех ровно один корректный canonical.${truncatedNote}` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${checkedCount} страниц.${truncatedNote}`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
