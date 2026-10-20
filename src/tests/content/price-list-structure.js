// Прайс-лист разбит по направлениям и категориям, у каждой позиции есть название и цена.
// Проверяются страница «Цены» и блоки цен на страницах направления и заболевания.
import { takeScreenshot } from '../helpers/common.js';

const pricePagePath = '/price/';
// Страницы с блоком цен из конструктора: направление и заболевание
const priceBlockPaths = ['/departments/himioterapiia/', '/diseases/angina/'];

const selectors = {
  department: '.department',
  departmentTitle: 'h2',
  priceBlock: '[id="price-container"]',
  category: 'details.js-details',
  categoryTitle: 'summary.details__title',
  item: '.spollers-cost__item',
  itemName: '.spollers-cost__name',
  itemPrice: '.spollers-cost__price',
};

// Сайт выводит цену либо как «12 345 ₽», либо текстом без цифр («по запросу»)
const numericPricePattern = /^(\d{1,3}(?: \d{3})*) ₽$/;
const onRequestPattern = /по\s+запросу/i;
const maxExamples = 3;

function formatExamples(list) {
  const shown = list.slice(0, maxExamples).join('; ');
  return list.length > maxExamples ? `${shown} и ещё ${list.length - maxExamples}` : shown;
}

// Счётчики и списки найденных проблем
function createTally() {
  return {
    structure: {
      missingBlocks: [],
      untitledDepartments: [],
      emptyDepartments: [],
      emptyBlocks: [],
      untitledCategories: [],
      emptyCategories: [],
    },
    prices: {
      missingName: [],
      emptyPrice: [],
      zeroPrice: [],
      invalidPrice: [],
    },
    categoryCount: 0,
    itemCount: 0,
    onRequestCount: 0,
  };
}

function collectCategory(tally, category, categoryLabel) {
  tally.categoryCount += 1;
  if (!category.title) tally.structure.untitledCategories.push(categoryLabel);
  if (category.items.length === 0) tally.structure.emptyCategories.push(categoryLabel);

  category.items.forEach((item, itemIndex) => {
    tally.itemCount += 1;
    const itemLabel = `${categoryLabel} -> ${item.name || `позиция №${itemIndex + 1}`}`;
    if (!item.name) tally.prices.missingName.push(itemLabel);

    if (!item.price) {
      tally.prices.emptyPrice.push(itemLabel);
      return;
    }
    const numeric = item.price.match(numericPricePattern);
    if (numeric) {
      if (Number(numeric[1].replace(/ /g, '')) <= 0) tally.prices.zeroPrice.push(`${itemLabel} («${item.price}»)`);
      return;
    }
    if (onRequestPattern.test(item.price)) {
      tally.onRequestCount += 1;
      return;
    }
    tally.prices.invalidPrice.push(`${itemLabel} («${item.price}»)`);
  });
}

// Выполняется в браузере через evaluateAll, поэтому не может обращаться к переменным этого файла
function readPriceGroups(els, sel) {
  const clean = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return els.map((root) => ({
    title: clean(root.querySelector(sel.departmentTitle)),
    categories: [...root.querySelectorAll(sel.category)].map((cat) => ({
      title: clean(cat.querySelector(sel.categoryTitle)),
      items: [...cat.querySelectorAll(sel.item)].map((item) => ({
        name: clean(item.querySelector(sel.itemName)),
        price: clean(item.querySelector(sel.itemPrice)),
      })),
    })),
  }));
}

async function openPage(browser, pageUrl) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1_000);
  return page;
}

export default {
  id: 'price-list-structure',
  title: 'Прайс-лист отображается структурированно по категориям услуг, суммы указаны корректно',

  async run({ siteUrl, browser }) {
    const priceUrl = new URL(pricePagePath, siteUrl).href;
    const pages = [priceUrl, ...priceBlockPaths.map((path) => new URL(path, siteUrl).href)];
    const tally = createTally();
    const pageSummaries = [];

    // 1. Страница «Цены»
    const page = await openPage(browser, priceUrl);
    const departments = await page.locator(selectors.department).evaluateAll(readPriceGroups, selectors);

    // Для скриншота раскрываем первую категорию
    const firstSpoller = page.locator(selectors.category).first();
    if (await firstSpoller.count() > 0) {
      await firstSpoller.evaluate((el) => { el.open = true; });
      await firstSpoller.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
    const media = [await takeScreenshot(page)];
    await page.close();

    if (departments.length === 0) {
      tally.structure.missingBlocks.push(`${pricePagePath} (${selectors.department})`);
    }
    departments.forEach((department, departmentIndex) => {
      const departmentLabel = `${pricePagePath} -> ${department.title || `направление №${departmentIndex + 1}`}`;
      if (!department.title) tally.structure.untitledDepartments.push(departmentLabel);
      if (department.categories.length === 0) tally.structure.emptyDepartments.push(departmentLabel);
      department.categories.forEach((category, categoryIndex) => {
        collectCategory(tally, category, `${departmentLabel} -> ${category.title || `категория №${categoryIndex + 1}`}`);
      });
    });
    pageSummaries.push(`${pricePagePath}: ${tally.itemCount} поз.`);

    // 2. Блоки цен на других страницах
    for (const path of priceBlockPaths) {
      const blockPage = await openPage(browser, new URL(path, siteUrl).href);
      const blocks = await blockPage.locator(selectors.priceBlock).evaluateAll(readPriceGroups, selectors);
      await blockPage.close();

      if (blocks.length === 0) {
        tally.structure.missingBlocks.push(`${path} (${selectors.priceBlock})`);
        pageSummaries.push(`${path}: блок цен не найден`);
        continue;
      }

      const itemsBefore = tally.itemCount;
      blocks.forEach(({ categories }, blockIndex) => {
        const blockLabel = blocks.length > 1 ? `${path} -> блок №${blockIndex + 1}` : path;
        if (categories.length === 0) tally.structure.emptyBlocks.push(blockLabel);
        categories.forEach((category, categoryIndex) => {
          collectCategory(tally, category, `${blockLabel} -> ${category.title || `категория №${categoryIndex + 1}`}`);
        });
      });
      pageSummaries.push(`${path}: ${tally.itemCount - itemsBefore} поз.`);
    }

    // 3. Итог
    const problemLabels = [
      [tally.structure.missingBlocks, 'страницы без прайса'],
      [tally.structure.untitledDepartments, 'направления без заголовка'],
      [tally.structure.emptyDepartments, 'направления без категорий услуг'],
      [tally.structure.emptyBlocks, 'блоки цен без категорий услуг'],
      [tally.structure.untitledCategories, 'категории без названия'],
      [tally.structure.emptyCategories, 'категории без позиций'],
      [tally.prices.missingName, 'позиции без названия услуги'],
      [tally.prices.emptyPrice, 'позиции без цены'],
      [tally.prices.zeroPrice, 'позиции с ценой «0 ₽»'],
      [tally.prices.invalidPrice, 'позиции с ценой в некорректном формате'],
    ];
    const problems = problemLabels
      .filter(([list]) => list.length > 0)
      .map(([list, label]) => `${label} (${list.length}): ${formatExamples(list)}`);

    const summary = `страниц: ${pageSummaries.length} (${pageSummaries.join(', ')}), категорий: ${tally.categoryCount}, позиций: ${tally.itemCount}`;

    if (problems.length > 0) {
      return {
        passed: false,
        comment: `Проверено: ${summary}. Найдено проблем: ${problems.length}.`,
        problems,
        media,
        pages,
      };
    }

    const onRequestNote = tally.onRequestCount > 0 ? `, из них ${tally.onRequestCount} «по запросу»` : '';
    return {
      passed: true,
      comment: `Прайс структурирован по категориям (${summary}). У всех позиций есть название и корректная цена в рублях${onRequestNote}.`,
      media,
      pages,
    };
  },
};
