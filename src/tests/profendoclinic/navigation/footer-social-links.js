import { PAGE_TIMEOUT_MS, errorMessage } from '../helpers.js';

const selectors = {
  footer: 'footer.footer',
  socialLinks: '.footer__social-link',
};
const settleTimeoutMs = 15_000;

export default {
  id: 'footer-social-links',
  title: 'Ссылки на соцсети и мессенджеры в футере рабочие',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

    const footer = page.locator(selectors.footer);
    if (await footer.count() === 0) {
      return { passed: false, comment: `На главной странице не найден ${selectors.footer}.` };
    }

    const links = await footer.locator(selectors.socialLinks).evaluateAll((els) => els.map((el) => el.getAttribute('href') || ''));
    if (links.length === 0) {
      return { passed: false, comment: `В футере не найдено ссылок ${selectors.socialLinks}.` };
    }

    let lastStatus = null;
    page.on('response', (response) => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) {
        lastStatus = response.status();
      }
    });

    const problems = [];
    const throttled = [];
    for (const href of links) {
      if (!href) {
        problems.push('пустая ссылка на соцсеть/мессенджер');
        continue;
      }
      if (/^(mailto|tel):/i.test(href)) continue;

      lastStatus = null;
      const error = await page.goto(new URL(href, siteUrl).href, { waitUntil: 'commit', timeout: PAGE_TIMEOUT_MS })
        .then(() => null, (reason) => reason);
      await page.waitForLoadState('domcontentloaded', { timeout: settleTimeoutMs }).catch(() => {});

      if (lastStatus === null) problems.push(`${href}: ${error ? errorMessage(error) : 'страница не ответила'}`);
      else if (lastStatus === 429) throttled.push(href);
      else if (lastStatus >= 400) problems.push(`${href}: HTTP ${lastStatus}`);
    }

    if (problems.length > 0) {
      return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems };
    }

    let comment = `Проверено ${links.length - throttled.length} ссылок на соцсети/мессенджеры, все рабочие.`;
    if (throttled.length > 0) {
      comment += ` Не удалось проверить: ${throttled.join(', ')} (площадка ограничила автоматические запросы, HTTP 429).`;
    }
    return { passed: true, comment };
  },
};
