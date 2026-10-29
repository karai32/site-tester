// Список врачей листается кнопкой под списком: «Показать ещё» добавляет порцию врачей
// и меняет надпись на «Показать всех», второе нажатие выводит всех оставшихся,
// после чего кнопка пропадает. Повторов в списке быть не должно.
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  doctorCard: '.doctor-item',
  moreBlock: '.js-doctors-more',
  moreButton: '.js-doctors-more-btn',
  moreText: '.doctors-more__text',
};
const waitMs = 15_000; // сколько ждать новых врачей после нажатия

// Врачи в списке по порядку: по одной ссылке с каждой карточки
function collectDoctors(page) {
  return page.locator(selectors.doctorCard).evaluateAll((cards) => cards
    .map((card) => card.querySelector('a[href*="/doctors/"]')?.getAttribute('href'))
    .filter(Boolean));
}

// Надпись на кнопке или null, если кнопки не видно
async function readButton(page) {
  const block = page.locator(selectors.moreBlock).first();
  if (!(await block.isVisible().catch(() => false))) return null;
  const text = await block.locator(selectors.moreText).first().textContent();
  return (text || '').trim();
}

// Нажимает кнопку и ждёт, пока в списке станет больше врачей. Возвращает новый список.
async function clickAndWait(page, countBefore) {
  // Нажимаем скриптом: всплывающее окно сайта может перекрыть кнопку для обычного клика
  await page.locator(selectors.moreButton).first().evaluate((element) => element.click());

  const deadline = Date.now() + waitMs;
  let doctors = await collectDoctors(page);
  while (doctors.length <= countBefore && Date.now() < deadline) {
    await page.waitForTimeout(500);
    doctors = await collectDoctors(page);
  }
  return doctors;
}

export default {
  id: 'doctors-pagination',
  title: 'Листание списка врачей работает корректно',

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

    // 1. «Показать ещё» добавляет порцию врачей
    const firstText = await readButton(page);
    if (firstText !== 'Показать ещё') {
      problems.push(`под списком нет кнопки «Показать ещё» (видно: ${firstText || 'ничего'})`);
    } else {
      const countBefore = doctors.length;
      doctors = await clickAndWait(page, countBefore);
      counts.push(doctors.length);
      if (doctors.length <= countBefore) {
        problems.push(`после «Показать ещё» новые врачи не появились за ${waitMs / 1000} секунд`);
      }
    }

    // 2. Кнопка стала «Показать всех» и выводит всех оставшихся
    if (problems.length === 0) {
      const secondText = await readButton(page);
      if (secondText !== 'Показать всех') {
        problems.push(`после первого нажатия кнопка не сменилась на «Показать всех» (видно: ${secondText || 'ничего'})`);
      } else {
        const countBefore = doctors.length;
        doctors = await clickAndWait(page, countBefore);
        counts.push(doctors.length);
        if (doctors.length <= countBefore) {
          problems.push(`после «Показать всех» новые врачи не появились за ${waitMs / 1000} секунд`);
        }
      }
    }

    // 3. Все врачи выведены: кнопка пропала, повторов нет
    if (problems.length === 0) {
      const lastText = await readButton(page);
      if (lastText !== null) problems.push(`после «Показать всех» кнопка осталась («${lastText}»)`);
    }
    const uniqueCount = new Set(doctors).size;
    if (uniqueCount < doctors.length) {
      problems.push(`в списке повторы: карточек ${doctors.length}, разных врачей ${uniqueCount}`);
    }

    // Скриншот конца списка: под ним была кнопка
    await page.locator(selectors.doctorCard).last().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(3_000); // фото врачей грузятся только после прокрутки
    const media = [await takeScreenshot(page)];

    if (problems.length === 0) {
      const [atStart, afterMore, afterAll] = counts;
      return {
        passed: true,
        comment: `Врачей в списке сначала ${atStart}, после «Показать ещё» ${afterMore}, после «Показать всех» ${afterAll}, затем кнопка пропала. Повторов нет.`,
        media,
        pages,
      };
    }
    return {
      passed: false,
      comment: `Найдено проблем: ${problems.length}. Врачей в списке по шагам: ${counts.join(', ')}.`,
      problems,
      media,
      pages,
    };
  },
};
