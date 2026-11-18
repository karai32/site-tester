import { PAGE_TIMEOUT_MS, getStatuses } from '../helpers.js';

const selectors = {
  menu: '.menu-header',
  menuLinks: '.menu-header a[href]',
};

export default {
  id: 'menu-links',
  title: 'Все пункты главного меню кликабельны и ведут на существующие страницы',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

    const problems = [];
    if (await page.locator(selectors.menu).count() === 0) {
      problems.push(`не найдено меню ${selectors.menu}`);
    }

    const rawLinks = await page.locator(selectors.menuLinks).evaluateAll((links) => links.map((link) => ({
      title: (link.textContent || '').replace(/\s+/g, ' ').trim(),
      href: (link.getAttribute('href') || '').trim(),
    })));
    if (rawLinks.length === 0) problems.push('в главном меню нет ни одной ссылки');

    const uniqueLinks = new Map();
    for (const link of rawLinks) {
      if (!link.href || link.href.startsWith('#') || link.href.startsWith('javascript:')) {
        problems.push(`«${link.title || 'без названия'}»: некорректный href="${link.href}"`);
        continue;
      }

      const target = new URL(link.href, siteUrl);
      if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        problems.push(`«${link.title || 'без названия'}»: ссылка не ведёт на веб-страницу`);
        continue;
      }
      target.hash = '';
      uniqueLinks.set(target.href, link.title);
    }

    const statuses = await getStatuses([...uniqueLinks.keys()]);
    for (const [url, { status, error }] of statuses) {
      const title = uniqueLinks.get(url);
      if (error) problems.push(`«${title}»: ${error}`);
      else if (status < 200 || status >= 400) problems.push(`«${title}»: HTTP ${status}`);
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${rawLinks.length} пунктов меню, ${uniqueLinks.size} уникальных страниц.`,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems };
  },
};
