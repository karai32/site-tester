import { request } from 'playwright';
import { PAGE_TIMEOUT_MS, PARALLEL_REQUESTS, REQUEST_TIMEOUT_MS, TEST_REQUESTS_PER_SECOND } from '../../config.js';

export { PAGE_TIMEOUT_MS };

export function errorMessage(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

export async function newPageWithoutCaptcha(browser, options) {
  const page = await browser.newPage(options);
  await page.route('https://smartcaptcha.cloud.yandex.ru/**', (route) => route.abort());
  return page;
}

export async function takeScreenshot(page, { fullPage = false } = {}) {
  return page.screenshot({ type: 'jpeg', quality: fullPage ? 45 : 60, fullPage });
}

let nextRequestAt = 0;

async function waitForTurn() {
  const now = Date.now();
  const startAt = Math.max(now, nextRequestAt);
  nextRequestAt = startAt + 1000 / TEST_REQUESTS_PER_SECOND;
  if (startAt > now) await new Promise((resolve) => setTimeout(resolve, startAt - now));
}

export async function getStatuses(urls) {
  const results = new Map();
  const queue = [...urls];
  const api = await request.newContext();

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      try {
        await waitForTurn();
        const head = await api.head(url, { failOnStatusCode: false, timeout: REQUEST_TIMEOUT_MS });
        let status = head.status();
        await head.dispose();

        if (status === 405 || status === 501) {
          await waitForTurn();
          const get = await api.get(url, { failOnStatusCode: false, timeout: REQUEST_TIMEOUT_MS });
          status = get.status();
          await get.dispose();
        }
        results.set(url, { status, error: null });
      } catch (error) {
        results.set(url, { status: 0, error: errorMessage(error) });
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, worker));
  } finally {
    await api.dispose();
  }

  return results;
}
