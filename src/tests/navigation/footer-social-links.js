// Ссылки на соцсети и мессенджеры в футере открываются
import { errorMessage } from '../helpers/common.js';

const selectors = {
  footer: 'footer.footer',
  socialLinks: '.footer__social-item',
};

export default {
  id: 'footer-social-links',
  title: 'Ссылки на соцсети и мессенджеры в футере рабочие',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const footer = page.locator(selectors.footer);
    if (await footer.count() === 0) {
      return { passed: false, comment: 'На главной странице не найден footer.footer.' };
    }

    const links = await footer.locator(selectors.socialLinks).evaluateAll((els) => els.map((el) => el.getAttribute('href') || ''));
    if (links.length === 0) {
      return { passed: false, comment: `В футере не найдено ссылок ${selectors.socialLinks}.` };
    }

    // Соцсети часто не отвечают на HEAD, поэтому сразу GET
    const problems = [];
    for (const href of links) {
      if (!href) {
        problems.push('пустая ссылка на соцсеть/мессенджер');
        continue;
      }
      try {
        const response = await page.request.get(href, { failOnStatusCode: false, timeout: 20_000 });
        const status = response.status();
        await response.dispose();
        if (status < 200 || status >= 400) problems.push(`${href}: HTTP ${status}`);
      } catch (error) {
        problems.push(`${href}: ${errorMessage(error)}`);
      }
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${links.length} ссылок на соцсети/мессенджеры, все рабочие.`,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems };
  },
};
