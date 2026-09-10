import { chromium } from '@playwright/test';
import { fetchPagesContent, checkPagesStatus } from '../../site-crawler.js';

const maxSourcesShown = 5;

function formatSources(sources) {
  if (sources.length === 0) return '';
  const shown = sources.slice(0, maxSourcesShown);
  const rest = sources.length - shown.length;
  return ` (найдена на: ${shown.join(', ')}${rest > 0 ? ` и ещё ${rest} стр.` : ''})`;
}

function extractImageUrls(html, baseUrl) {
  const urls = new Set();

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = match[0].match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (src && !src.startsWith('data:')) {
      try {
        urls.add(new URL(src, baseUrl).href);
      } catch {
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
      }
    }
  }

  return [...urls];
}

export const brokenImagesSitewide = {
  id: 'broken-images-sitewide',
  title: 'Отсутствие «битых» изображений по всем страницам сайта',

  async run({ url, htmlPages: pages, pagesTruncated, pagesError }) {
    if (pagesError) {
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: не удалось получить список страниц сайта (${pagesError})` };
    }

    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext({ ignoreHTTPSErrors: false });

      const imageSources = new Map();
      let pagesWithHtml = 0;

      for await (const [pageUrl, { html }] of fetchPagesContent(context.request, pages)) {
        if (!html) continue;
        pagesWithHtml += 1;

        for (const imageUrl of extractImageUrls(html, pageUrl)) {
          if (!imageSources.has(imageUrl)) imageSources.set(imageUrl, new Set());
          imageSources.get(imageUrl).add(pageUrl);
        }
      }

      const imageUrls = [...imageSources.keys()];
      const imageResults = await checkPagesStatus(context.request, imageUrls);

      const problems = [];

      for (const [imageUrl, { status, error }] of imageResults) {
        const isBroken = Boolean(error) || status < 200 || status >= 400;
        if (!isBroken) continue;

        const sources = [...(imageSources.get(imageUrl) || [])];
        const reason = error ? error : `HTTP ${status}`;
        problems.push(`${imageUrl}: ${reason}${formatSources(sources)}`);
      }

      const truncatedNote = pagesTruncated ? ' Внимание: список страниц обрезан предохранителем обхода, реальных страниц может быть больше.' : '';

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'passed',
          message: `Проверено ${pagesWithHtml} страниц и ${imageUrls.length} уникальных изображений, битых не найдено.${truncatedNote}`,
        }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${pagesWithHtml} страниц и ${imageUrls.length} изображений.${truncatedNote}`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
