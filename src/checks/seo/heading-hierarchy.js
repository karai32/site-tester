import { chromium } from '@playwright/test';

const maxPages = 500;
const batchSize = 8;
const maxDepth = 2;

function extractLinks(html, baseUrl, siteOrigin) {
  const links = new Set();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = match[1];
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    try {
      const target = new URL(href, baseUrl);
      if (target.origin !== siteOrigin) continue;
      target.hash = '';
      links.add(target.href);
    } catch {
      // ignore malformed URLs
    }
  }
  return [...links];
}

async function crawlSite(api, startUrl) {
  const siteOrigin = new URL(startUrl).origin;
  const visited = new Map();
  const queued = new Set([startUrl]);
  const queue = [{ url: startUrl, depth: 0 }];

  while (queue.length > 0 && visited.size < maxPages) {
    const batch = queue.splice(0, batchSize);
    await Promise.all(batch.map(async ({ url: pageUrl, depth }) => {
      if (visited.has(pageUrl) || visited.size >= maxPages) return;

      try {
        const response = await api.get(pageUrl, { failOnStatusCode: false, timeout: 15_000 });
        const status = response.status();
        const contentType = response.headers()['content-type'] || '';
        const html = status >= 200 && status < 400 && contentType.includes('text/html') ? await response.text() : null;
        await response.dispose();
        visited.set(pageUrl, { status, html });

        if (html && depth < maxDepth) {
          for (const link of extractLinks(html, pageUrl, siteOrigin)) {
            if (!queued.has(link)) {
              queued.add(link);
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
        visited.set(pageUrl, { status: 0, html: null, error: message });
      }
    }));
  }

  return visited;
}

export const headingHierarchy = {
  id: 'heading-hierarchy',
  title: 'Иерархия заголовков не нарушена (ровно один H1, без пропуска уровней) на всех страницах сайта',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext();
      const pages = await crawlSite(context.request, url);

      const problems = [];
      let checkedCount = 0;

      for (const [pageUrl, { html }] of pages) {
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

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${checkedCount} страниц (обход сайта, глубина ${maxDepth}), иерархия заголовков корректна.` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${checkedCount} страниц.`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
