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

function getRobotsMetaContent(html) {
  const forward = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  if (forward) return forward[1].trim();
  const backward = html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["']/i);
  return backward ? backward[1].trim() : null;
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

export const robotsMeta = {
  id: 'robots-meta',
  title: 'Meta robots присутствует и не содержит случайного noindex на всех страницах сайта',

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

        const content = getRobotsMetaContent(html);

        if (content === null) {
          problems.push(`${pageUrl}: тег meta robots отсутствует`);
        } else if (/noindex/i.test(content)) {
          problems.push(`${pageUrl}: meta robots содержит noindex ("${content}")`);
        }
      }

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${checkedCount} страниц (обход сайта, глубина ${maxDepth}), meta robots в порядке.` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${checkedCount} страниц.`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
