import { PAGE_TIMEOUT_MS } from '../helpers.js';

const selectors = {
  form: 'form.wpcf7-form',
  captcha: '.smart-captcha-token-container',
};
const captchaInitTimeoutMs = 30_000;

function describeForm({ wpcf7Id, popup }, index) {
  const location = popup ? `, попап "${popup}"` : '';
  return `форма №${index + 1} (wpcf7-id=${wpcf7Id || '?'}${location})`;
}

export default {
  id: 'forms-spam-protection',
  title: 'Формы защищены от спама (капча/honeypot) без ухудшения UX',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

    const forms = page.locator(selectors.form);
    const formCount = await forms.count();
    if (formCount === 0) {
      return { passed: false, comment: 'На странице не найдено ни одной формы wpcf7-form для проверки.' };
    }

    await page.waitForFunction(({ form, captcha }) => {
      const elements = [...document.querySelectorAll(form)];
      return elements.every((element) => element.querySelector(`${captcha} iframe`));
    }, selectors, { timeout: captchaInitTimeoutMs }).catch(() => {});

    const formsMeta = await forms.evaluateAll((elements, captcha) => elements.map((form) => {
      const container = form.querySelector(captcha);
      const popup = form.closest('.popup');
      return {
        wpcf7Id: form.closest('.wpcf7')?.dataset.wpcf7Id || null,
        popup: popup ? [...popup.classList].find((name) => name.startsWith('popup-')) || null : null,
        hasContainer: Boolean(container),
        hasIframe: Boolean(container?.querySelector('iframe')),
      };
    }), selectors.captcha);

    const problems = [];
    formsMeta.forEach((meta, index) => {
      const description = describeForm(meta, index);
      if (!meta.hasContainer) {
        problems.push(`${description}: не найден контейнер капчи ${selectors.captcha}`);
      } else if (!meta.hasIframe) {
        problems.push(`${description}: капча SmartCaptcha не инициализировалась (пустой контейнер, нет iframe)`);
      }
    });

    if (problems.length === 0) {
      return { passed: true, comment: `Проверено ${formCount} форм(ы), у всех активна капча SmartCaptcha.` };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems };
  },
};
