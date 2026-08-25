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

export const canonicalUrls = {
  id: 'canonical-urls',
  title: 'Canonical URL указан ровно один раз и является корректной абсолютной ссылкой на всех страницах сайта',

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

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${checkedCount} страниц (обход сайта, глубина ${maxDepth}), у всех ровно один корректный canonical.` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${checkedCount} страниц.`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
