import { chromium } from '@playwright/test';

const selectors = {
  footer: 'footer.footer',
  socialLinks: '.footer__social-item',
};

export const footerSocialLinks = {
  id: 'footer-social-links',
  title: 'Ссылки на соцсети и мессенджеры в футере рабочие',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext({ ignoreHTTPSErrors: false });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const footer = page.locator(selectors.footer);
      if (await footer.count() === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: 'На главной странице не найден footer.footer.' };
      }

      const links = await footer.locator(selectors.socialLinks).evaluateAll((els) => els.map((el) => el.getAttribute('href') || ''));
      if (links.length === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `В футере не найдено ссылок ${selectors.socialLinks}.` };
      }

      const problems = [];

      for (const href of links) {
        if (!href) {
          problems.push('пустая ссылка на соцсеть/мессенджер');
          continue;
        }

        try {
          const response = await context.request.get(href, { failOnStatusCode: false, timeout: 20_000 });
          const status = response.status();
          await response.dispose();
          if (status < 200 || status >= 400) {
            problems.push(`${href}: HTTP ${status}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
          problems.push(`${href}: ${message}`);
        }
      }

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${links.length} ссылок на соцсети/мессенджеры, все рабочие.` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}.`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
