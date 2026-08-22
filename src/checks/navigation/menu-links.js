import { chromium } from '@playwright/test';

const selectors = {
  menu: 'nav.nav',
  menuLinks: '.nav > .nav-item a[href]',
};

function problemMessage(problems) {
  const visible = problems.slice(0, 8).join('; ');
  const rest = problems.length > 8 ? `; ещё ${problems.length - 8}` : '';
  return `Найдено проблем: ${problems.length}. ${visible}${rest}.`;
}

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

export const menuLinks = {
  id: 'menu-links',
  title: 'Все пункты главного меню кликабельны и ведут на существующие страницы',

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

      const problems = [];
      const menu = page.locator(selectors.menu);
      if (await menu.count() === 0) {
        problems.push(`не найдена обёртка ${selectors.menu}`);
      }

      const rawLinks = await page.locator(selectors.menuLinks).evaluateAll((links) => links.map((link) => ({
        title: (link.textContent || '').replace(/\s+/g, ' ').trim(),
        href: (link.getAttribute('href') || '').trim(),
      })));
      const uniqueLinks = new Map();

      for (const link of rawLinks) {
        if (!link.href || link.href.startsWith('#') || link.href.startsWith('javascript:')) {
          problems.push(`«${link.title || 'без названия'}»: некорректный href="${link.href}"`);
          continue;
        }

        const target = new URL(link.href, url);
        if (target.protocol !== 'http:' && target.protocol !== 'https:') {
          problems.push(`«${link.title || 'без названия'}»: ссылка не ведёт на веб-страницу`);
          continue;
        }

        target.hash = '';
        uniqueLinks.set(target.href, { url: target.href, title: link.title });
      }

      const inspected = await inspectLinks(context.request, [...uniqueLinks.values()]);
      for (const link of inspected) {
        if (link.error) {
          problems.push(`«${link.title}»: ${link.error}`);
        } else if (link.status < 200 || link.status >= 400) {
          problems.push(`«${link.title}»: HTTP ${link.status}`);
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: `Проверено ${rawLinks.length} пунктов меню, ${inspected.length} уникальных страниц.`,
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
