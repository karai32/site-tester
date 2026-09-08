import { chromium } from '@playwright/test';

const captchaInitTimeoutMs = 8_000;

function describeForm({ wpcf7Id, modalId, actionPath }) {
  const location = modalId ? `модалка="${modalId}"` : `action="${actionPath || '/'}"`;
  return `wpcf7-id=${wpcf7Id || '?'}, ${location}`;
}

export const formsSpamProtection = {
  id: 'forms-spam-protection',
  title: 'Формы защищены от спама (капча/honeypot) без ухудшения UX',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(1_000);

      const forms = page.locator('form.wpcf7-form');
      const formCount = await forms.count();

      if (formCount === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: 'На странице не найдено ни одной формы wpcf7-form для проверки.' };
      }

      await page.evaluate(() => {
        const firstField = document.querySelector('form.wpcf7-form input, form.wpcf7-form textarea');
        firstField?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      });

      await page.waitForFunction(() => window.cfycCaptchaLoaded === true, undefined, { timeout: captchaInitTimeoutMs }).catch(() => {});

      const formsMeta = await forms.evaluateAll((elements) => elements.map((form) => {
        const action = form.getAttribute('action') || '';
        const [actionPath] = action.split('#');
        const modal = form.closest('.modal');
        return {
          actionPath: actionPath || null,
          modalId: modal ? modal.id : null,
          wpcf7Id: (form.closest('.wpcf7') || {}).dataset?.wpcf7Id || null,
        };
      }));

      const problems = [];

      for (let index = 0; index < formCount; index += 1) {
        const form = forms.nth(index);
        const container = form.locator('.cfyc-captcha-container').first();
        const description = describeForm(formsMeta[index] || {});

        if (await container.count() === 0) {
          problems.push(`форма №${index + 1} (${description}): не найден контейнер капчи .cfyc-captcha-container`);
          continue;
        }

        const iframeCount = await container.locator('iframe').count();
        if (iframeCount === 0) {
          problems.push(`форма №${index + 1} (${description}): капча SmartCaptcha не инициализировалась после взаимодействия с формой (пустой контейнер, нет iframe)`);
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'passed',
          message: `Проверено ${formCount} форм(ы), у всех активна капча SmartCaptcha.`,
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
