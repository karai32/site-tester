import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { request } from 'playwright';
import { PARALLEL_REQUESTS, REQUEST_TIMEOUT_MS } from '../config.js';

export const MAX_PAGES = 4000;

export function errorMessage(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

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

function isHtml(status, contentType) {
  return status >= 200 && status < 400 && contentType.includes('text/html');
}

async function fetchPage(api, url) {
  const head = await api.head(url, { failOnStatusCode: false, timeout: REQUEST_TIMEOUT_MS });
  const headStatus = head.status();
  const headType = head.headers()['content-type'] || '';
  await head.dispose();

  const headNotSupported = headStatus === 405 || headStatus === 501;
  if (!headNotSupported && !isHtml(headStatus, headType)) return { status: headStatus, html: null };

  const response = await api.get(url, { failOnStatusCode: false, timeout: REQUEST_TIMEOUT_MS });
  const status = response.status();
  const type = response.headers()['content-type'] || '';
  const html = isHtml(status, type) ? await response.text() : null;
  await response.dispose();
  return { status, html };
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

  async function visit(pageUrl) {
    let page;
    try {
      page = await fetchPage(api, pageUrl);
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
  }

  const running = new Set();
  try {
    while ((queue.length > 0 || running.size > 0) && !shouldStop()) {
      while (queue.length > 0 && running.size < PARALLEL_REQUESTS) {
        const task = visit(queue.shift()).finally(() => running.delete(task));
        running.add(task);
      }
      await Promise.race(running);
    }
    await Promise.all(running);
  } finally {
    await api.dispose();
  }

  htmlPages.sort();
  return { htmlPages, linksByPage, statuses, truncated };
}

export function collectLinks(pages, linksByPage, statuses) {
  const links = new Map();

  for (const pageUrl of pages) {
    for (const url of linksByPage.get(pageUrl) || []) {
      if (!links.has(url)) {
        const known = statuses.get(url);
        links.set(url, {
          url,
          status: known ? known.status : null,
          error: known ? known.error : null,
          foundOn: [],
        });
      }
      links.get(url).foundOn.push(pageUrl);
    }
  }

  return Array.from(links.values());
}
