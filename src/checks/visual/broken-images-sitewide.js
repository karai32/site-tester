import { chromium } from '@playwright/test';

const selectors = {
  menuLinks: '.nav > .nav-item a[href]',
};
const maxImagesToCheck = 400;

function extractImageUrls(html, baseUrl) {
  const urls = new Set();

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = match[0].match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (src && !src.startsWith('data:')) {
      try {
        urls.add(new URL(src, baseUrl).href);
      } catch {
        // ignore malformed URLs
      }
    }
  }

  for (const match of html.matchAll(/<source\b[^>]*>/gi)) {
    const srcset = match[0].match(/\bsrcset=["']([^"']+)["']/i)?.[1];
    const firstUrl = srcset?.split(',')[0].trim().split(/\s+/)[0];
    if (firstUrl && !firstUrl.startsWith('data:')) {
      try {
        urls.add(new URL(firstUrl, baseUrl).href);
      } catch {
        // ignore malformed URLs
      }
    }
  }

  return [...urls];
}

async function fetchInBatches(api, urls, batchSize, handler) {
  for (let index = 0; index < urls.length; index += batchSize) {
    const batch = urls.slice(index, index + batchSize);
    await Promise.all(batch.map((item) => handler(item)));
  }
}

function problemMessage(problems) {
  const visible = problems.slice(0, 10).join('; ');
  const rest = problems.length > 10 ? `; ещё ${problems.length - 10}` : '';
  return `Найдено проблем: ${problems.length}. ${visible}${rest}.`;
}

export const brokenImagesSitewide = {
  id: 'broken-images-sitewide',
  title: 'Отсутствие «битых» изображений по ключевым страницам сайта',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext({ ignoreHTTPSErrors: false });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const rawLinks = await page.locator(selectors.menuLinks).evaluateAll((links) => links.map((link) => (link.getAttribute('href') || '').trim()));
      const siteOrigin = new URL(url).origin;
      const pageUrls = new Set([new URL('/', url).href]);

      for (const href of rawLinks) {
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
        const target = new URL(href, url);
        if (target.origin !== siteOrigin) continue;
        target.hash = '';
        pageUrls.add(target.href);
      }

      const imageUrls = new Set();
      const pageFetchProblems = [];

      await fetchInBatches(context.request, [...pageUrls], 6, async (pageUrl) => {
        try {
          const response = await context.request.get(pageUrl, { failOnStatusCode: false, timeout: 20_000 });
          if (response.status() >= 200 && response.status() < 400) {
            const html = await response.text();
            for (const imageUrl of extractImageUrls(html, pageUrl)) {
              imageUrls.add(imageUrl);
            }
          }
          await response.dispose();
        } catch (error) {
          const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
          pageFetchProblems.push(`${pageUrl}: не удалось загрузить (${message})`);
        }
      });

      const sample = [...imageUrls].slice(0, maxImagesToCheck);
      const problems = [...pageFetchProblems];

      await fetchInBatches(context.request, sample, 6, async (imageUrl) => {
        try {
          const response = await context.request.get(imageUrl, { failOnStatusCode: false, timeout: 20_000 });
          const status = response.status();
          await response.dispose();
          if (status < 200 || status >= 400) {
            problems.push(`${imageUrl}: HTTP ${status}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
          problems.push(`${imageUrl}: ${message}`);
        }
      });

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: `Проверено ${pageUrls.size} страниц и ${sample.length} уникальных изображений, битых не найдено.`,
        }
        : { id: this.id, title: this.title, status: 'failed', message: problemMessage(problems) };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
