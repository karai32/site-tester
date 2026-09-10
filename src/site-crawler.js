import { chromium } from '@playwright/test';

const discoveryBatchSize = 8;
const discoveryTimeoutMs = 15_000;
const maxLinkSourcesPerUrl = 10;
const maxDiscoveredPages = 4000;

function extractLinks(html, baseUrl, siteOrigin) {
  const links = new Set();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = match[1];
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    try {
      const target = new URL(href, baseUrl);
      if (target.origin !== siteOrigin) continue;
      target.hash = '';
      target.search = '';
      links.add(target.href);
    } catch {
    }
  }
  return [...links];
}

export async function discoverSitePages(baseUrl) {
  const startUrl = new URL(baseUrl);
  startUrl.hash = '';
  startUrl.search = '';

  const normalizedBaseUrl = startUrl.href;
  const siteOrigin = startUrl.origin;
  const discovered = new Set([normalizedBaseUrl]);
  const htmlPages = new Set();
  const linkSources = new Map();
  const queue = [normalizedBaseUrl];
  const processed = new Set();
  let truncated = false;

  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext();

    while (queue.length > 0) {
      const batch = queue.splice(0, discoveryBatchSize);
      await Promise.all(batch.map(async (pageUrl) => {
        if (processed.has(pageUrl)) return;
        processed.add(pageUrl);

        try {
          const headResponse = await context.request.head(pageUrl, { failOnStatusCode: false, timeout: discoveryTimeoutMs });
          const headStatus = headResponse.status();
          const headContentType = headResponse.headers()['content-type'] || '';
          await headResponse.dispose();

          const headUnsupported = headStatus === 405 || headStatus === 501;
          const looksLikeHtml = headStatus >= 200 && headStatus < 400 && headContentType.includes('text/html');

          let html = null;
          if (headUnsupported || looksLikeHtml) {
            const response = await context.request.get(pageUrl, { failOnStatusCode: false, timeout: discoveryTimeoutMs });
            const status = response.status();
            const contentType = response.headers()['content-type'] || '';
            html = status >= 200 && status < 400 && contentType.includes('text/html') ? await response.text() : null;
            await response.dispose();
          }

          if (html) {
            htmlPages.add(pageUrl);
            for (const link of extractLinks(html, pageUrl, siteOrigin)) {
              if (!discovered.has(link)) {
                if (discovered.size >= maxDiscoveredPages) {
                  truncated = true;
                  continue;
                }
                discovered.add(link);
                queue.push(link);
              }

              if (!linkSources.has(link)) linkSources.set(link, new Set());
              const sources = linkSources.get(link);
              if (sources.size < maxLinkSourcesPerUrl) sources.add(pageUrl);
            }
          }
        } catch {
        }
      }));
    }
  } finally {
    await browser?.close().catch(() => {});
  }

  return { pages: [...discovered], htmlPages: [...htmlPages], truncated, linkSources };
}
