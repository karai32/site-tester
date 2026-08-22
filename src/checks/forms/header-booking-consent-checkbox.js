import { chromium } from '@playwright/test';

const selectors = {
  trigger: 'header [data-modal="call"]',
  checkboxLabel: '#call form.wpcf7-form .agreement-checkbox',
  checkbox: '#call form.wpcf7-form input[name="agreement"]',
};

function problemMessage(problems) {
  return `Найдено проблем: ${problems.length}. ${problems.join('; ')}.`;
}

export const headerBookingConsentCheckbox = {
  id: 'header-booking-consent-checkbox',
  title: 'Чекбокс согласия на обработку ПДн присутствует и по умолчанию не отмечен',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      await page.locator(selectors.trigger).first().click();
      await page.waitForTimeout(600);

      const checkbox = page.locator(selectors.checkbox).first();
      if (await checkbox.count() === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: 'В форме записи не найден чекбокс согласия на обработку ПДн.' };
      }

      await checkbox.scrollIntoViewIfNeeded();
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      const problems = [];

      const labelText = (await page.locator(selectors.checkboxLabel).first().textContent().catch(() => '') || '').trim();
      if (!/персональн/i.test(labelText)) {
        problems.push('текст рядом с чекбоксом не упоминает согласие на обработку персональных данных');
      }

      const isChecked = await checkbox.isChecked();
      if (isChecked) {
        problems.push('чекбокс согласия отмечен по умолчанию (checked="checked") — пользователь должен подтвердить согласие сам, а не снимать уже стоящую галочку');
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: 'Чекбокс согласия на обработку ПДн присутствует, снят по умолчанию, текст со ссылкой на политику на месте.',
          screenshot,
        }
        : { id: this.id, title: this.title, status: 'failed', message: problemMessage(problems), screenshot };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
