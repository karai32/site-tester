import { chromium } from '@playwright/test';

const departmentPath = '/departments/onkologia/';
const selectors = {
  doctorItem: '.doctor-item',
  appointmentForm: 'form.wpcf7-form',
};

export const departmentContentComplete = {
  id: 'department-content-complete',
  title: 'Список услуг и врачей направления отображается полностью',

  async run({ url }) {
    let browser;
    const target = new URL(departmentPath, url).href;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(1_500);

      const bodyTextLength = await page.evaluate(() => document.body.innerText.length);
      const doctorItems = page.locator(selectors.doctorItem);
      const doctorCount = await doctorItems.count();
      const formCount = await page.locator(selectors.appointmentForm).count();

      if (doctorCount > 0) {
        await doctorItems.first().scrollIntoViewIfNeeded();
      }
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      const problems = [];
      if (bodyTextLength < 3_000) {
        problems.push(`страница содержит слишком мало текста (${bodyTextLength} символов) — раздел услуг выглядит пустым`);
      }
      if (doctorCount === 0) {
        problems.push('на странице направления не найдено ни одного врача');
      }
      if (formCount === 0) {
        problems.push('на странице направления не найдено формы записи');
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title, pageUrl: target,
          status: 'passed',
          message: `Страница ${target}: контент раздела услуг присутствует (${bodyTextLength} символов текста), найдено ${doctorCount} врачей и ${formCount} форм(ы) записи. Скриншот приложен для визуальной проверки вёрстки.`,
          screenshot,
        }
        : { id: this.id, title: this.title, pageUrl: target, status: 'failed', message: `Найдено проблем: ${problems.length}. ${problems.join('; ')}.`, screenshot };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: target, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
