// Список врачей листается кнопкой «Показать ещё»: каждое нажатие добавляет новых врачей
// без повторов, а номер страницы виден в адресе
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  doctorCard: '.doctor-item',
  showMore: '.js-doctors-more-btn',
};
const pagesToCheck = [2, 3];
const waitMs = 10_000; // сколько ждать новых врачей после нажатия

// Врачи в списке по порядку: по одной ссылке с каждой карточки
function collectDoctors(page) {
  return page.locator(selectors.doctorCard).evaluateAll((cards) => cards
    .map((card) => card.querySelector('a[href*="/doctors/"]')?.getAttribute('href'))
    .filter(Boolean));
}

// Номер страницы в адресе: ?page=2 или /page/2/
function urlHasPage(url, number) {
  return url.includes(`page=${number}`) || url.includes(`/page/${number}/`);
}

export default {
  id: 'doctors-pagination',
  title: 'Листание списка врачей работает корректно, URL отражает номер страницы',

  async run({ siteUrl, browser }) {
    const listUrl = new URL('/doctors/', siteUrl).href;
    const pages = [listUrl];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    let doctors = await collectDoctors(page);
    if (doctors.length === 0) {
      return { passed: false, comment: `На странице ${listUrl} не найдено ни одного врача.`, pages };
    }

    const counts = [doctors.length]; // сколько врачей в списке после каждого шага
    const problems = [];

    for (const pageNumber of pagesToCheck) {
      const button = page.locator(selectors.showMore).first();
      if (!(await button.isVisible().catch(() => false))) {
        problems.push(`страница ${pageNumber}: нет кнопки «Показать ещё»`);
        break;
      }

      // Нажимаем скриптом: всплывающее окно сайта может перекрыть кнопку для обычного клика
      const countBefore = doctors.length;
      await button.evaluate((element) => element.click());

      // Ждём, пока в списке появятся новые врачи
      const deadline = Date.now() + waitMs;
      do {
        await page.waitForTimeout(500);
        doctors = await collectDoctors(page);
      } while (doctors.length <= countBefore && Date.now() < deadline);
      counts.push(doctors.length);

      if (doctors.length <= countBefore) {
        problems.push(`страница ${pageNumber}: после «Показать ещё» новые врачи не появились за ${waitMs / 1000} секунд`);
        break;
      }

      const uniqueCount = new Set(doctors).size;
      if (uniqueCount < doctors.length) {
        problems.push(`страница ${pageNumber}: в списке повторы (карточек ${doctors.length}, разных врачей ${uniqueCount})`);
      }
      if (!urlHasPage(page.url(), pageNumber)) {
        problems.push(`страница ${pageNumber}: адрес не отражает номер страницы (${page.url()})`);
      }
    }

    const media = [await takeScreenshot(page)];
    const growth = counts.join(' -> ');

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Кнопка «Показать ещё» листает список врачей (${growth}), повторов нет, номер страницы виден в адресе.`,
        media,
        pages,
      };
    }
    return {
      passed: false,
      comment: `Найдено проблем: ${problems.length}. Врачей в списке по шагам: ${growth}.`,
      problems,
      media,
      pages,
    };
  },
};
