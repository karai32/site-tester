// Телефон в форме записи, введённый в разных форматах, приводится к одному виду
const selectors = {
  trigger: 'header [data-modal="call"]',
  phone: '#call form.wpcf7-form input[name="phone"]',
};

const baselineFormat = '1234567890';
const typedFormats = ['123-456-78-90', '123 456 78 90', '(123) 456-78-90'];
const pastedFormats = ['+71234567890', '81234567890', '+7 (123) 456-78-90', '8 123 456 78 90'];

// Вставка текста целиком, как из буфера обмена
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
  title: 'Разные форматы телефона в форме записи приводятся к единому виду',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator(selectors.trigger).first().click();
    await page.waitForTimeout(600);

    const phoneField = page.locator(selectors.phone).first();
    if (await phoneField.count() === 0) {
      return { passed: false, comment: 'Поле телефона в форме записи не найдено.' };
    }

    const steps = [
      { action: 'type', format: baselineFormat, description: `Базовый ввод: ${baselineFormat}` },
      ...typedFormats.map((format) => ({ action: 'type', format, description: `Ввод: ${format}` })),
      ...pastedFormats.map((format) => ({ action: 'paste', format, description: `Вставка: ${format}` })),
    ];

    const media = [];
    const lines = [];
    const problems = [];
    let expected = null; // результат базового ввода - с ним сравниваются остальные

    for (const step of steps) {
      await phoneField.fill('');
      if (step.action === 'paste') await pasteValue(phoneField, step.format);
      else await phoneField.pressSequentially(step.format, { delay: 15 });
      await page.waitForTimeout(200);

      const result = await phoneField.inputValue();
      if (expected === null) expected = result;

      lines.push(`${lines.length + 1}. ${step.description} -> ${result}`);
      media.push({ data: await phoneField.screenshot({ type: 'jpeg', quality: 60 }), caption: `${step.description} -> ${result}` });

      if (result !== expected) {
        problems.push(`${step.description}: приводится к «${result}», а не к ожидаемому «${expected}»`);
      }
    }

    return { passed: problems.length === 0, comment: lines.join('\n'), problems, media };
  },
};
