// Кнопка записи в шапке открывает форму целиком на страницах разных типов
import { takeScreenshot } from '../helpers/common.js';

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

export default {
  id: 'header-booking-form',
  title: 'Форма записи в шапке доступна и видима без багов вёрстки на всех типах страниц',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const problems = [];
    const media = [];

    for (const { path, label } of pagesToCheck) {
      await page.goto(new URL(path, siteUrl).href, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const trigger = page.locator(selectors.trigger).first();
      if (await trigger.count() === 0) {
        problems.push(`${label}: в шапке не найдена кнопка записи`);
        continue;
      }
      await trigger.click();
      await page.waitForTimeout(600);

      const phoneField = page.locator(selectors.phone).first();
      const submitButton = page.locator(selectors.submit).first();
      const phoneVisible = await phoneField.isVisible().catch(() => false);
      const submitVisible = await submitButton.isVisible().catch(() => false);
      const checkboxVisible = await page.locator(selectors.checkbox).first().isVisible().catch(() => false);

      if (!phoneVisible || !submitVisible || !checkboxVisible) {
        problems.push(`${label}: форма записи открылась не полностью (телефон: ${phoneVisible}, кнопка: ${submitVisible}, чекбокс: ${checkboxVisible})`);
      } else {
        // Поле телефона не должно заезжать на кнопку «Отправить»
        const phoneBox = await phoneField.boundingBox();
        const submitBox = await submitButton.boundingBox();
        if (phoneBox && submitBox && phoneBox.y + phoneBox.height > submitBox.y + 5) {
          problems.push(`${label}: поле телефона и кнопка «Отправить» перекрываются`);
        }
      }

      if (media.length === 0) media.push(await takeScreenshot(page));
    }

    const pages = pagesToCheck.map(({ path }) => new URL(path, siteUrl).href);
    return problems.length === 0
      ? { passed: true, comment: `Форма записи в шапке открывается корректно на ${pagesToCheck.length} типах страниц (${pagesToCheck.map((p) => p.label).join(', ')}).`, media, pages }
      : { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media, pages };
  },
};
