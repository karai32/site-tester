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

export const no404Links = {
  id: 'no-404-links',
  title: 'С сайта нельзя перейти на страницу с кодом 404',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext();
      const pages = await crawlSite(context.request, url);

      const problems = [];

      for (const [pageUrl, { status, error }] of pages) {
        if (error) {
          problems.push(`${pageUrl}: ${error}`);
        } else if (status < 200 || status >= 400) {
          problems.push(`${pageUrl}: HTTP ${status}`);
        }
      }

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${pages.size} страниц/ссылок (обход сайта, глубина ${maxDepth}), битых ссылок не найдено.` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${pages.size} страниц/ссылок.`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
