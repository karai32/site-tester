import { PAGE_TIMEOUT_MS, newPageWithoutCaptcha } from '../helpers.js';

const formPath = '/services/diabet-pod-kontrolem/';
const selectors = {
  phone: 'section.form-question input[name="your-phone"]',
};

const expectedDigits = '71234567890';
const expectedNumber = '+7 123 456 78 90';
const typedFormats = ['1234567890', '123-456-78-90', '123 456 78 90', '(123) 456-78-90'];
const pastedFormats = ['+71234567890', '81234567890', '+7 (123) 456-78-90', '8 123 456 78 90'];
const typingDelayMs = 100;

async function pasteValue(field, value) {
  await field.evaluate((el, val) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    el.focus();
    nativeSetter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

export default {
  id: 'header-booking-phone-normalization',
  title: 'Разные форматы телефона в форме заявки приводятся к единому виду',

  async run({ siteUrl, browser }) {
    const formUrl = new URL(formPath, siteUrl).href;
    const pages = [formUrl];
    const page = await newPageWithoutCaptcha(browser, { viewport: { width: 1440, height: 900 } });
    await page.goto(formUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await page.waitForLoadState('load', { timeout: PAGE_TIMEOUT_MS }).catch(() => {});

    const phoneField = page.locator(selectors.phone).first();
    if (await phoneField.count() === 0) {
      return { passed: false, comment: `На странице ${formUrl} не найдено поле телефона в форме заявки (${selectors.phone}).`, pages };
    }
    await phoneField.scrollIntoViewIfNeeded();

    const steps = [
      ...typedFormats.map((format) => ({ action: 'type', format, description: `Ввод: ${format}` })),
      ...pastedFormats.map((format) => ({ action: 'paste', format, description: `Вставка: ${format}` })),
    ];

    const media = [];
    const lines = [];
    const problems = [];
    let commonView = null;

    for (const step of steps) {
      await phoneField.fill('');
      if (step.action === 'paste') await pasteValue(phoneField, step.format);
      else await phoneField.pressSequentially(step.format, { delay: typingDelayMs });
      await page.waitForTimeout(300);

      const result = await phoneField.inputValue();
      lines.push(`${lines.length + 1}. ${step.description} -> ${result}`);
      media.push({ data: await phoneField.screenshot({ type: 'jpeg', quality: 60 }), caption: `${step.description} -> ${result}` });

      if (result.replace(/\D/g, '') !== expectedDigits) {
        problems.push(`${step.description}: получилось «${result}», а должен быть номер ${expectedNumber}`);
      } else if (commonView === null) {
        commonView = result;
      } else if (result !== commonView) {
        problems.push(`${step.description}: номер верный, но записан как «${result}», а не «${commonView}»`);
      }
    }
    await phoneField.fill('');

    return { passed: problems.length === 0, comment: lines.join('\n'), problems, media, pages };
  },
};
