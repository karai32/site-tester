import { chromium } from '@playwright/test';

const selectors = {
  trigger: 'header [data-modal="call"]',
  phone: '#call form.wpcf7-form input[name="phone"]',
};

const baselineFormat = '9261234567';
const formatsToCheck = ['+79261234567', '89261234567', '+7 (926) 123-45-67', '8 926 123 45 67'];

function problemMessage(problems) {
  return `Найдено проблем: ${problems.length}. ${problems.join('; ')}.`;
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
        return { id: this.id, title: this.title, status: 'failed', message: 'Поле телефона в форме записи не найдено.' };
      }

      await phoneField.fill('');
      await phoneField.pressSequentially(baselineFormat, { delay: 15 });
      await page.waitForTimeout(200);
      const canonical = await phoneField.inputValue();

      const problems = [];

      for (const format of formatsToCheck) {
        await phoneField.fill('');
        await phoneField.pressSequentially(format, { delay: 15 });
        await page.waitForTimeout(200);
        const result = await phoneField.inputValue();

        if (result !== canonical) {
          problems.push(`«${format}» приводится к «${result}», а не к ожидаемому «${canonical}»`);
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: `Все проверенные форматы телефона приводятся к единому виду «${canonical}».`,
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
