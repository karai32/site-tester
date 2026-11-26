import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { request } from 'playwright';
import { CRAWL_REQUESTS_PER_SECOND, PARALLEL_REQUESTS, REQUEST_TIMEOUT_MS } from '../config.js';

export const MAX_PAGES = 4000;
const MAX_SITEMAP_FILES = 50;

let nextRequestAt = 0;

async function waitForTurn() {
  const now = Date.now();
  const startAt = Math.max(now, nextRequestAt);
  nextRequestAt = startAt + 1000 / CRAWL_REQUESTS_PER_SECOND;
  if (startAt > now) await new Promise((resolve) => setTimeout(resolve, startAt - now));
}

export function errorMessage(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

function siteAddress(href, baseUrl, siteOrigin) {
  try {
    const target = new URL(href, baseUrl);
    if (target.origin !== siteOrigin) return null;
    target.hash = '';
    target.search = '';
    return target.href;
  } catch {
    return null;
  }
}

function extractLinks(html, pageUrl, siteOrigin) {
  const links = new Set();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = match[1];
    if (href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) continue;
    const address = siteAddress(href, pageUrl, siteOrigin);
    if (address) links.add(address);
  }
  return [...links];
}

async function fetchText(api, url) {
  try {
    await waitForTurn();
    const response = await api.get(url, { failOnStatusCode: false, timeout: REQUEST_TIMEOUT_MS });
    const text = response.status() === 200 ? await response.text() : '';
    await response.dispose();
    return text;
  } catch {
    return '';
  }
}

async function readSitemap(api, siteOrigin) {
  const robots = await fetchText(api, `${siteOrigin}/robots.txt`);
  const listed = [...robots.matchAll(/^Sitemap:\s*(\S+)/gim)].map((match) => match[1]);
  const files = listed.length > 0 ? listed : [`${siteOrigin}/sitemap.xml`];
  const seen = new Set();
  const pages = new Set();

  while (files.length > 0 && seen.size < MAX_SITEMAP_FILES) {
    const file = files.shift();
    if (seen.has(file) || !file.startsWith(`${siteOrigin}/`)) continue;
    seen.add(file);

    const xml = await fetchText(api, file);
    const addresses = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\s\]]+)/gi)]
      .map((match) => match[1].replaceAll('&amp;', '&'));
    if (/<sitemapindex\b/i.test(xml)) {
      files.push(...addresses);
      continue;
    }
    for (const address of addresses) {
      const page = siteAddress(address, siteOrigin, siteOrigin);
      if (page) pages.add(page);
    }
  }

  return [...pages];
}

function isHtml(status, contentType) {
  return status >= 200 && status < 400 && contentType.includes('text/html');
}

function looksLikeFile(url) {
  return /\.(?!html?$|php$)[a-z0-9]+$/i.test(new URL(url).pathname);
}

async function fetchPage(api, url) {
  if (looksLikeFile(url)) {
    await waitForTurn();
    const head = await api.head(url, { failOnStatusCode: false, timeout: REQUEST_TIMEOUT_MS });
    const headStatus = head.status();
    const headType = head.headers()['content-type'] || '';
    await head.dispose();

    const headNotSupported = headStatus === 405 || headStatus === 501;
    if (!headNotSupported && !isHtml(headStatus, headType)) return { status: headStatus, html: null };
  }

  await waitForTurn();
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

  function enqueue(url) {
    if (found.has(url)) return;
    if (found.size >= MAX_PAGES) {
      truncated = true;
      return;
    }
    found.add(url);
    queue.push(url);
  }

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

    for (const link of links) enqueue(link);
  }

  const running = new Set();
  try {
    for (const page of await readSitemap(api, start.origin)) enqueue(page);

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
