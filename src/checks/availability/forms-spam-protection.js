import { chromium } from '@playwright/test';

function problemMessage(problems) {
  const visible = problems.slice(0, 8).join('; ');
  const rest = problems.length > 8 ? `; ещё ${problems.length - 8}` : '';
  return `Найдено проблем: ${problems.length}. ${visible}${rest}.`;
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
      await page.waitForTimeout(3_000);

      const forms = page.locator('form.wpcf7-form');
      const formCount = await forms.count();

      if (formCount === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: 'На странице не найдено ни одной формы wpcf7-form для проверки.' };
      }

      const problems = [];

      for (let index = 0; index < formCount; index += 1) {
        const form = forms.nth(index);
        const container = form.locator('.cfyc-captcha-container').first();

        if (await container.count() === 0) {
          problems.push(`форма №${index + 1}: не найден контейнер капчи .cfyc-captcha-container`);
          continue;
        }

        const iframeCount = await container.locator('iframe').count();
        if (iframeCount === 0) {
          problems.push(`форма №${index + 1}: капча SmartCaptcha не инициализировалась (пустой контейнер, нет iframe)`);
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: `Проверено ${formCount} форм(ы), у всех активна капча SmartCaptcha.`,
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
