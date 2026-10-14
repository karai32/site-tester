// Обход сайта: начинает с главной и переходит по внутренним ссылкам,
// пока не найдёт все страницы (но не больше MAX_PAGES).
// HTML каждой страницы сохраняется в папку htmlDir, чтобы тесты не скачивали его заново.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { request } from 'playwright';

const BATCH_SIZE = 8; // сколько адресов скачиваем одновременно
const TIMEOUT_MS = 15_000;
export const MAX_PAGES = 4000; // предохранитель от бесконечных адресов

// Внутренние ссылки из HTML страницы, без #якорей и ?параметров
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
      // некорректный адрес в href — пропускаем
    }
  }
  return [...links];
}

// Скачивает адрес. Возвращает { status, html }: html — null, если это не HTML-страница.
async function fetchPage(api, url) {
  // Сначала HEAD: так не скачиваем PDF и картинки целиком
  const head = await api.head(url, { failOnStatusCode: false, timeout: TIMEOUT_MS });
  const headStatus = head.status();
  const headType = head.headers()['content-type'] || '';
  await head.dispose();

  // Некоторые серверы не поддерживают HEAD (405, 501) — тогда смотрим GET
  const headNotSupported = headStatus === 405 || headStatus === 501;
  const looksLikeHtml = headStatus >= 200 && headStatus < 400 && headType.includes('text/html');
  if (!looksLikeHtml && !headNotSupported) return { status: headStatus, html: null };

  const response = await api.get(url, { failOnStatusCode: false, timeout: TIMEOUT_MS });
  const status = response.status();
  const type = response.headers()['content-type'] || '';
  const html = status >= 200 && status < 400 && type.includes('text/html') ? await response.text() : null;
  await response.dispose();
  return { status, html };
}

function htmlFile(htmlDir, url) {
  return join(htmlDir, `${createHash('sha1').update(url).digest('hex')}.html`);
}

// HTML страницы, сохранённый при обходе, или null
export function readSavedHtml(htmlDir, url) {
  const file = htmlFile(htmlDir, url);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/**
 * shouldStop() — если вернёт true, обход прекращается (проверку отменили).
 * Возвращает:
 *   htmlPages   — адреса HTML-страниц сайта
 *   linksByPage — Map: адрес страницы → внутренние ссылки на ней (страницы и файлы)
 *   statuses    — Map: адрес → { status, error }, HTTP-статус каждого найденного адреса
 *   truncated   — true, если обход остановлен на MAX_PAGES
 */
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
          page = await fetchPage(api, pageUrl);
          statuses.set(pageUrl, { status: page.status, error: null });
        } catch (error) {
          statuses.set(pageUrl, { status: 0, error: error.message.split('\n')[0] });
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
