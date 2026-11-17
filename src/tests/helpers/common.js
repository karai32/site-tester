import { request } from 'playwright';

export function errorMessage(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

export async function takeScreenshot(page, { fullPage = false } = {}) {
  await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
  return page.screenshot({ type: 'jpeg', quality: fullPage ? 45 : 60, fullPage });
}

function isHtml(status, contentType) {
  return status >= 200 && status < 400 && contentType.includes('text/html');
}

export async function fetchUrl(api, url, { timeoutMs, withHtml = false }) {
  const head = await api.head(url, { failOnStatusCode: false, timeout: timeoutMs });
  const headStatus = head.status();
  const headType = head.headers()['content-type'] || '';
  await head.dispose();

  const headNotSupported = headStatus === 405 || headStatus === 501;
  const needsHtml = withHtml && isHtml(headStatus, headType);
  if (!headNotSupported && !needsHtml) return { status: headStatus, html: null };

  const response = await api.get(url, { failOnStatusCode: false, timeout: timeoutMs });
  const status = response.status();
  const type = response.headers()['content-type'] || '';
  const html = withHtml && isHtml(status, type) ? await response.text() : null;
  await response.dispose();
  return { status, html };
}

export async function getStatuses(urls, { batchSize = 8, timeoutMs = 15_000 } = {}) {
  const results = new Map();
  const api = await request.newContext();

  try {
    for (let index = 0; index < urls.length; index += batchSize) {
      const batch = urls.slice(index, index + batchSize);
      await Promise.all(batch.map(async (url) => {
        try {
          const { status } = await fetchUrl(api, url, { timeoutMs });
          results.set(url, { status, error: null });
        } catch (error) {
          results.set(url, { status: 0, error: errorMessage(error) });
        }
      }));
    }
  } finally {
    await api.dispose();
  }

  return results;
}
