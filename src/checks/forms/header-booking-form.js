import { chromium } from '@playwright/test';

const pagesToCheck = [
  { path: '/', label: 'главная' },
  { path: '/doctors/averkov-oleg-valerevich/', label: 'страница врача' },
  { path: '/departments/onkologia/', label: 'страница направления' },
  { path: '/price/', label: 'страница цен' },
];

const selectors = {
  trigger: 'header [data-modal="call"]',
  phone: '#call form.wpcf7-form input[name="phone"]',
  submit: '#call form.wpcf7-form input[type="submit"]',
  checkbox: '#call form.wpcf7-form input[name="agreement"]',
};

export const headerBookingForm = {
  id: 'header-booking-form',
  title: 'Форма записи в шапке доступна и видима без багов вёрстки на всех типах страниц',

  async run({ url }) {
    let browser;
    const pageUrls = pagesToCheck.map(({ path }) => new URL(path, url).href);

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

      const problems = [];
      let screenshot;

      for (const { path, label } of pagesToCheck) {
        const target = new URL(path, url).href;
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });

        const trigger = page.locator(selectors.trigger).first();
        if (await trigger.count() === 0) {
          problems.push(`${label}: в шапке не найдена кнопка записи`);
          continue;
        }

        await trigger.click();
        await page.waitForTimeout(600);

        const phoneField = page.locator(selectors.phone).first();
        const submitButton = page.locator(selectors.submit).first();
        const checkbox = page.locator(selectors.checkbox).first();

        const phoneVisible = await phoneField.isVisible().catch(() => false);
        const submitVisible = await submitButton.isVisible().catch(() => false);
        const checkboxVisible = await checkbox.isVisible().catch(() => false);

        if (!phoneVisible || !submitVisible || !checkboxVisible) {
          problems.push(`${label}: форма записи открылась не полностью (телефон: ${phoneVisible}, кнопка: ${submitVisible}, чекбокс: ${checkboxVisible})`);
        } else {
          const phoneBox = await phoneField.boundingBox();
          const submitBox = await submitButton.boundingBox();
          if (phoneBox && submitBox && phoneBox.y + phoneBox.height > submitBox.y + 5) {
            problems.push(`${label}: поле телефона и кнопка «Отправить» перекрываются`);
          }
        }

        if (!screenshot) {
          await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
          const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
          screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: `Форма записи в шапке открывается корректно на ${pagesToCheck.length} типах страниц (${pagesToCheck.map((p) => p.label).join(', ')}).`,
          screenshot,
          pageUrls,
        }
        : { id: this.id, title: this.title, status: 'failed', message: `Найдено проблем: ${problems.length}.`, problems, screenshot, pageUrls };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}`, pageUrls };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
