// На странице направления есть текст об услугах, врачи и форма записи
import { takeScreenshot } from '../helpers/common.js';

const departmentPath = '/departments/onkologia/';
const selectors = {
  doctorItem: '.doctor-item',
  appointmentForm: 'form.wpcf7-form',
};
const minTextLength = 3_000;

export default {
  id: 'department-content-complete',
  title: 'Список услуг и врачей направления отображается полностью',

  async run({ siteUrl, browser }) {
    const target = new URL(departmentPath, siteUrl).href;
    const pages = [target];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1_500);

    const bodyTextLength = await page.evaluate(() => document.body.innerText.length);
    const doctorItems = page.locator(selectors.doctorItem);
    const doctorCount = await doctorItems.count();
    const formCount = await page.locator(selectors.appointmentForm).count();

    if (doctorCount > 0) await doctorItems.first().scrollIntoViewIfNeeded();
    const media = [await takeScreenshot(page)];

    const problems = [];
    if (bodyTextLength < minTextLength) {
      problems.push(`страница содержит слишком мало текста (${bodyTextLength} символов) — раздел услуг выглядит пустым`);
    }
    if (doctorCount === 0) problems.push('на странице направления не найдено ни одного врача');
    if (formCount === 0) problems.push('на странице направления не найдено формы записи');

    return problems.length === 0
      ? { passed: true, comment: `Страница ${target}: контент раздела услуг присутствует (${bodyTextLength} символов текста), найдено ${doctorCount} врачей и ${formCount} форм(ы) записи. Скриншот приложен для визуальной проверки вёрстки.`, media, pages }
      : { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media, pages };
  },
};
