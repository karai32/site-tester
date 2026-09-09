import { chromium } from '@playwright/test';

const selectors = {
  trigger: 'header [data-modal="call"]',
  phone: '#call form.wpcf7-form input[name="phone"]',
};

const baselineFormat = '1234567890';
const localFormatsToCheck = ['123-456-78-90', '123 456 78 90', '(123) 456-78-90'];
const pastedFormatsToCheck = ['+71234567890', '81234567890', '+7 (123) 456-78-90', '8 123 456 78 90'];

async function pasteValue(field, value) {
  await field.evaluate((el, val) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    el.focus();
    nativeSetter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function captureFieldScreenshot(field) {
  const buffer = await field.screenshot({ type: 'jpeg', quality: 60 });
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

export const headerBookingPhoneNormalization = {
  id: 'header-booking-phone-normalization',
  title: 'Разные форматы телефона в форме записи приводятся к единому виду',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      await page.locator(selectors.trigger).first().click();
      await page.waitForTimeout(600);

      const phoneField = page.locator(selectors.phone).first();
      if (await phoneField.count() === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: 'Поле телефона в форме записи не найдено.' };
      }

      const steps = [
        { action: 'type', format: baselineFormat, description: `Базовый ввод: ${baselineFormat}` },
        ...localFormatsToCheck.map((format) => ({ action: 'type', format, description: `Ввод: ${format}` })),
        ...pastedFormatsToCheck.map((format) => ({ action: 'paste', format, description: `Вставка: ${format}` })),
      ];

      const screenshots = [];
      const testDescriptions = [];
      const problems = [];
      let canonical = null;

      for (const step of steps) {
        await phoneField.fill('');
        if (step.action === 'paste') {
          await pasteValue(phoneField, step.format);
        } else {
          await phoneField.pressSequentially(step.format, { delay: 15 });
        }
        await page.waitForTimeout(200);
        const result = await phoneField.inputValue();

        if (canonical === null) canonical = result;

        testDescriptions.push(`${testDescriptions.length + 1}. ${step.description} → ${result}`);
        screenshots.push({ image: await captureFieldScreenshot(phoneField) });

        if (result !== canonical) {
          problems.push(`${step.description}: приводится к «${result}», а не к ожидаемому «${canonical}»`);
        }
      }

      const message = testDescriptions.join('\n');

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message, screenshots }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message, problems, screenshots };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
