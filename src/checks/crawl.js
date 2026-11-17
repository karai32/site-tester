import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { request } from 'playwright';
import { errorMessage, fetchUrl } from '../tests/helpers/common.js';

const BATCH_SIZE = 8;
const TIMEOUT_MS = 15_000;
export const MAX_PAGES = 4000;

function extractLinks(html, pageUrl, siteOrigin) {
  const links = new Set();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = match[1];
    if (href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) continue;
    try {
      const target = new URL(href, pageUrl);
      if (target.origin !== siteOrigin) continue;
      target.hash = '';
      target.search = '';
      links.add(target.href);
    } catch {
    }
  }
  return [...links];
}

function htmlFile(htmlDir, url) {
  return join(htmlDir, `${createHash('sha1').update(url).digest('hex')}.html`);
}

export function readSavedHtml(htmlDir, url) {
  const file = htmlFile(htmlDir, url);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

export async function crawlSite(siteUrl, htmlDir, shouldStop = () => false) {
  const start = new URL(siteUrl);
  start.hash = '';
  start.search = '';

  const found = new Set([start.href]);
  const queue = [start.href];
  const htmlPages = [];
  const linksByPage = new Map();
  const statuses = new Map();
  let truncated = false;

  const api = await request.newContext();
  try {
    while (queue.length > 0 && !shouldStop()) {
      const batch = queue.splice(0, BATCH_SIZE);
      await Promise.all(batch.map(async (pageUrl) => {
        let page;
        try {
          page = await fetchUrl(api, pageUrl, { timeoutMs: TIMEOUT_MS, withHtml: true });
          statuses.set(pageUrl, { status: page.status, error: null });
        } catch (error) {
          statuses.set(pageUrl, { status: 0, error: errorMessage(error) });
          return;
        }
        if (!page.html) return;

        writeFileSync(htmlFile(htmlDir, pageUrl), page.html);
        const links = extractLinks(page.html, pageUrl, start.origin);
        htmlPages.push(pageUrl);
        linksByPage.set(pageUrl, links);

        for (const link of links) {
          if (found.has(link)) continue;
          if (found.size >= MAX_PAGES) {
            truncated = true;
            continue;
          }
          found.add(link);
          queue.push(link);
        }
      }));
    }
  } finally {
    await api.dispose();
  }

  htmlPages.sort();
  return { htmlPages, linksByPage, statuses, truncated };
}
