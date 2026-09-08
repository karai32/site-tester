import { chromium } from '@playwright/test';

const discoveryBatchSize = 8;
const discoveryTimeoutMs = 15_000;
const maxDiscoveredPages = 500;
const maxLinkSourcesPerUrl = 10;

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
  const linkSources = new Map();
  const queue = [normalizedBaseUrl];
  const processed = new Set();
  let truncated = false;

  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext();

    while (queue.length > 0) {
      if (processed.size >= maxDiscoveredPages) {
        truncated = true;
        break;
      }

      const batch = queue.splice(0, discoveryBatchSize);
      await Promise.all(batch.map(async (pageUrl) => {
        if (processed.has(pageUrl) || processed.size >= maxDiscoveredPages) return;
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

  return { pages: [...discovered], truncated, linkSources };
}

export async function* fetchPagesContent(request, pageUrls, { batchSize = 8, timeoutMs = 15_000 } = {}) {
  for (let index = 0; index < pageUrls.length; index += batchSize) {
    const batch = pageUrls.slice(index, index + batchSize);
    const results = await Promise.all(batch.map(async (pageUrl) => {
      try {
        const headResponse = await request.head(pageUrl, { failOnStatusCode: false, timeout: timeoutMs });
        const headStatus = headResponse.status();
        const headContentType = headResponse.headers()['content-type'] || '';
        await headResponse.dispose();

        const headUnsupported = headStatus === 405 || headStatus === 501;
        const looksLikeHtml = headStatus >= 200 && headStatus < 400 && headContentType.includes('text/html');

        if (!looksLikeHtml && !headUnsupported) {
          return [pageUrl, { status: headStatus, html: null }];
        }

        const response = await request.get(pageUrl, { failOnStatusCode: false, timeout: timeoutMs });
        const status = response.status();
        const contentType = response.headers()['content-type'] || '';
        const html = status >= 200 && status < 400 && contentType.includes('text/html') ? await response.text() : null;
        await response.dispose();
        return [pageUrl, { status, html }];
      } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
        return [pageUrl, { status: 0, html: null, error: message }];
      }
    }));

    for (const result of results) {
      yield result;
    }
  }
}

export async function checkPagesStatus(request, pageUrls, { batchSize = 8, timeoutMs = 15_000 } = {}) {
  const results = new Map();

  for (let index = 0; index < pageUrls.length; index += batchSize) {
    const batch = pageUrls.slice(index, index + batchSize);
    await Promise.all(batch.map(async (pageUrl) => {
      try {
        const headResponse = await request.head(pageUrl, { failOnStatusCode: false, timeout: timeoutMs });
        let status = headResponse.status();
        await headResponse.dispose();

        if (status === 405 || status === 501) {
          const getResponse = await request.get(pageUrl, { failOnStatusCode: false, timeout: timeoutMs });
          status = getResponse.status();
          await getResponse.dispose();
        }

        results.set(pageUrl, { status });
      } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
        results.set(pageUrl, { status: 0, error: message });
      }
    }));
  }

  return results;
}
