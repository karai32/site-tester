import { chromium } from '@playwright/test';

const selectors = {
  menuLinks: '.nav > .nav-item a[href]',
};

async function inspectLinks(api, links) {
  const inspected = [];

  for (let index = 0; index < links.length; index += 4) {
    const batch = links.slice(index, index + 4);
    const results = await Promise.all(batch.map(async (link) => {
      try {
        const response = await api.get(link.url, { failOnStatusCode: false, timeout: 20_000 });
        const status = response.status();
        await response.dispose();
        return { ...link, status };
      } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
        return { ...link, error: message };
      }
    }));

    inspected.push(...results);
  }

  return inspected;
}

export const brokenLinks = {
  id: 'broken-links',
  title: 'Отсутствие битых ссылок (404) на ключевых страницах',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext({
        ignoreHTTPSErrors: false,
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const rawLinks = await page.locator(selectors.menuLinks).evaluateAll((links) => links.map((link) => ({
        title: (link.textContent || '').replace(/\s+/g, ' ').trim(),
        href: (link.getAttribute('href') || '').trim(),
      })));

      const uniqueLinks = new Map();
      const siteOrigin = new URL(url).origin;

      for (const link of rawLinks) {
        if (!link.href || link.href.startsWith('#') || link.href.startsWith('javascript:')) continue;

        const target = new URL(link.href, url);
        if (target.origin !== siteOrigin) continue;

        target.hash = '';
        uniqueLinks.set(target.href, { url: target.href, title: link.title });
      }

      const inspected = await inspectLinks(context.request, [...uniqueLinks.values()]);
      const problems = [];

      for (const link of inspected) {
        if (link.error) {
          problems.push(`«${link.title}»: ${link.error}`);
        } else if (link.status < 200 || link.status >= 400) {
          problems.push(`«${link.title}» (${link.url}): HTTP ${link.status}`);
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'passed',
          message: `Проверено ${inspected.length} внутренних ссылок из главного меню, битых ссылок не найдено.`,
        }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}.`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
