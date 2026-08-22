import { chromium } from '@playwright/test';

const selectors = {
  menuLinks: '.nav > .nav-item a[href]',
};

function problemMessage(problems) {
  const visible = problems.slice(0, 8).join('; ');
  const rest = problems.length > 8 ? `; ещё ${problems.length - 8}` : '';
  return `Найдено проблем: ${problems.length}. ${visible}${rest}.`;
}

function findLogoHref(html) {
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    const className = tag.match(/\bclass=["']([^"']*)["']/i)?.[1] || '';
    const classes = className.split(/\s+/);

    if (classes.includes('logo') && classes.includes('header__logo')) {
      return tag.match(/\bhref=["']([^"']*)["']/i)?.[1] || null;
    }
  }

  return null;
}

export const logoHome = {
  id: 'logo-home',
  title: 'Логотип в шапке ведёт на главную страницу с любой страницы сайта',

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

      const expectedHome = new URL('/', url).href;
      const siteOrigin = new URL(url).origin;

      const rawHrefs = await page.locator(selectors.menuLinks).evaluateAll((links) => links.map((link) => (link.getAttribute('href') || '').trim()));
      const internalUrls = new Set([expectedHome]);

      for (const href of rawHrefs) {
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
        const target = new URL(href, url);
        if (target.origin !== siteOrigin) continue;
        target.hash = '';
        internalUrls.add(target.href);
      }

      const problems = [];

      for (const pageUrl of internalUrls) {
        try {
          const html = pageUrl === expectedHome
            ? await page.content()
            : await (await context.request.get(pageUrl, { failOnStatusCode: false, timeout: 20_000 })).text();

          const logoHref = findLogoHref(html);
          if (!logoHref || new URL(logoHref, pageUrl).href !== expectedHome) {
            problems.push(`${pageUrl}: логотип ведёт на ${logoHref || 'неизвестный адрес'}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
          problems.push(`${pageUrl}: страницу не удалось проверить (${message})`);
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: `Логотип ведёт на главную на ${internalUrls.size} внутренних страницах из меню.`,
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
