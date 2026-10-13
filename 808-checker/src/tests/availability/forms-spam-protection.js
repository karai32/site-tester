// У всех форм на главной включается капча SmartCaptcha
const captchaInitTimeoutMs = 8_000;

function describeForm({ wpcf7Id, modalId, actionPath }) {
  const location = modalId ? `модалка="${modalId}"` : `action="${actionPath || '/'}"`;
  return `wpcf7-id=${wpcf7Id || '?'}, ${location}`;
}

export default {
  id: 'forms-spam-protection',
  title: 'Формы защищены от спама (капча/honeypot) без ухудшения UX',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();
    await page.goto(siteUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(1_000);

    const forms = page.locator('form.wpcf7-form');
    const formCount = await forms.count();
    if (formCount === 0) {
      return { passed: false, comment: 'На странице не найдено ни одной формы wpcf7-form для проверки.' };
    }

    // Капча подгружается, когда посетитель начинает заполнять форму
    await page.evaluate(() => {
      const firstField = document.querySelector('form.wpcf7-form input, form.wpcf7-form textarea');
      firstField?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    await page.waitForFunction(() => window.cfycCaptchaLoaded === true, undefined, { timeout: captchaInitTimeoutMs }).catch(() => {});

    const formsMeta = await forms.evaluateAll((elements) => elements.map((form) => {
      const [actionPath] = (form.getAttribute('action') || '').split('#');
      const modal = form.closest('.modal');
      return {
        actionPath: actionPath || null,
        modalId: modal ? modal.id : null,
        wpcf7Id: (form.closest('.wpcf7') || {}).dataset?.wpcf7Id || null,
      };
    }));

    const problems = [];
    for (let index = 0; index < formCount; index += 1) {
      const container = forms.nth(index).locator('.cfyc-captcha-container').first();
      const description = describeForm(formsMeta[index] || {});

      if (await container.count() === 0) {
        problems.push(`форма №${index + 1} (${description}): не найден контейнер капчи .cfyc-captcha-container`);
        continue;
      }
      if (await container.locator('iframe').count() === 0) {
        problems.push(`форма №${index + 1} (${description}): капча SmartCaptcha не инициализировалась после взаимодействия с формой (пустой контейнер, нет iframe)`);
      }
    }

    return problems.length === 0
      ? { passed: true, comment: `Проверено ${formCount} форм(ы), у всех активна капча SmartCaptcha.` }
      : { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems };
  },
};
