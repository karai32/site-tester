// На странице направления выведены список услуг (блок «Цены на услуги») и врачи отделения,
// у каждой услуги и каждого врача есть название
import { takeScreenshot } from '../helpers/common.js';

const departmentPath = '/departments/onkologia/';
const selectors = {
  serviceName: '[id="price-container"] .spollers-cost__name',
  doctorCard: '.doctor-item',
  doctorName: '.doctor-item__name',
};

// Тексты элементов страницы без лишних пробелов
function readTexts(page, selector) {
  return page.locator(selector).evaluateAll((elements) => elements.map((element) => element.textContent.replace(/\s+/g, ' ').trim()));
}

export default {
  id: 'department-content-complete',
  title: 'Список услуг и врачей направления отображается полностью',

  async run({ siteUrl, browser }) {
    const target = new URL(departmentPath, siteUrl).href;
    const pages = [target];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1_500);

    const serviceNames = await readTexts(page, selectors.serviceName);
    const doctorNames = await readTexts(page, selectors.doctorName);

    const doctorCards = page.locator(selectors.doctorCard);
    if (await doctorCards.count() > 0) await doctorCards.first().scrollIntoViewIfNeeded();
    const media = [await takeScreenshot(page)];

    const problems = [];
    if (serviceNames.length === 0) {
      problems.push('на странице не найден список услуг (блок «Цены на услуги»)');
    } else {
      const emptyServices = serviceNames.filter((name) => !name).length;
      if (emptyServices > 0) problems.push(`у ${emptyServices} из ${serviceNames.length} услуг нет названия`);
    }
    if (doctorNames.length === 0) {
      problems.push('на странице не найдено ни одного врача');
    } else {
      const emptyDoctors = doctorNames.filter((name) => !name).length;
      if (emptyDoctors > 0) problems.push(`у ${emptyDoctors} из ${doctorNames.length} врачей нет имени`);
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Страница ${target}: в списке услуг ${serviceNames.length} позиций, врачей отделения: ${doctorNames.length}. У всех есть названия.`,
        media,
        pages,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media, pages };
  },
};
