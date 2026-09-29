import { chromium } from '@playwright/test';

const pricePagePath = '/price/';
// Страницы с блоком цен из конструктора: направление и заболевание.
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

// format_price() на сайте выводит либо «12 345 ₽», либо исходный текст без цифр («по запросу»).
const numericPricePattern = /^(\d{1,3}(?: \d{3})*) ₽$/;
const onRequestPattern = /по\s+запросу/i;
const maxExamples = 3;

const formatExamples = (list) => {
  const shown = list.slice(0, maxExamples).join('; ');
  return list.length > maxExamples ? `${shown} и ещё ${list.length - maxExamples}` : shown;
};

const createReport = () => ({
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
});

function collectCategory(report, cat, catLabel) {
  report.categoryCount += 1;
  if (!cat.title) report.structure.untitledCategories.push(catLabel);
  if (cat.items.length === 0) report.structure.emptyCategories.push(catLabel);

  cat.items.forEach((item, itemIndex) => {
    report.itemCount += 1;
    const itemLabel = `${catLabel} → ${item.name || `позиция №${itemIndex + 1}`}`;
    if (!item.name) report.prices.missingName.push(itemLabel);

    if (!item.price) {
      report.prices.emptyPrice.push(itemLabel);
      return;
    }
    const numeric = item.price.match(numericPricePattern);
    if (numeric) {
      if (Number(numeric[1].replace(/ /g, '')) <= 0) report.prices.zeroPrice.push(`${itemLabel} («${item.price}»)`);
      return;
    }
    if (onRequestPattern.test(item.price)) {
      report.onRequestCount += 1;
      return;
    }
    report.prices.invalidPrice.push(`${itemLabel} («${item.price}»)`);
  });
}

// Выполняется в браузере через evaluateAll, поэтому не должна ссылаться на внешние переменные.
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

export const priceListStructure = {
  id: 'price-list-structure',
  title: 'Прайс-лист отображается структурированно по категориям услуг, суммы указаны корректно',

  async run({ url }) {
    let browser;
    const priceUrl = new URL(pricePagePath, url).href;

    try {
      browser = await chromium.launch();
      const report = createReport();
      const pageSummaries = [];

      const page = await openPage(browser, priceUrl);
      const departments = await page.locator(selectors.department).evaluateAll(readPriceGroups, selectors);

      const firstSpoller = page.locator(selectors.category).first();
      if (await firstSpoller.count() > 0) {
        await firstSpoller.evaluate((el) => { el.open = true; });
        await firstSpoller.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      }
      await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
      await page.close();

      if (departments.length === 0) {
        report.structure.missingBlocks.push(`${pricePagePath} (${selectors.department})`);
      }
      const priceItemsBefore = report.itemCount;
      departments.forEach((dept, deptIndex) => {
        const deptLabel = `${pricePagePath} → ${dept.title || `направление №${deptIndex + 1}`}`;
        if (!dept.title) report.structure.untitledDepartments.push(deptLabel);
        if (dept.categories.length === 0) report.structure.emptyDepartments.push(deptLabel);
        dept.categories.forEach((cat, catIndex) => {
          collectCategory(report, cat, `${deptLabel} → ${cat.title || `категория №${catIndex + 1}`}`);
        });
      });
      pageSummaries.push(`${pricePagePath} — ${report.itemCount - priceItemsBefore} поз.`);

      for (const path of priceBlockPaths) {
        const blockPage = await openPage(browser, new URL(path, url).href);
        const blocks = await blockPage.locator(selectors.priceBlock).evaluateAll(readPriceGroups, selectors);
        await blockPage.close();

        if (blocks.length === 0) {
          report.structure.missingBlocks.push(`${path} (${selectors.priceBlock})`);
          pageSummaries.push(`${path} — блок цен не найден`);
          continue;
        }

        const itemsBefore = report.itemCount;
        blocks.forEach(({ categories }, blockIndex) => {
          const blockLabel = blocks.length > 1 ? `${path} → блок №${blockIndex + 1}` : path;
          if (categories.length === 0) report.structure.emptyBlocks.push(blockLabel);
          categories.forEach((cat, catIndex) => {
            collectCategory(report, cat, `${blockLabel} → ${cat.title || `категория №${catIndex + 1}`}`);
          });
        });
        pageSummaries.push(`${path} — ${report.itemCount - itemsBefore} поз.`);
      }

      const problemLabels = [
        [report.structure.missingBlocks, 'страницы без прайса'],
        [report.structure.untitledDepartments, 'направления без заголовка'],
        [report.structure.emptyDepartments, 'направления без категорий услуг'],
        [report.structure.emptyBlocks, 'блоки цен без категорий услуг'],
        [report.structure.untitledCategories, 'категории без названия'],
        [report.structure.emptyCategories, 'категории без позиций'],
        [report.prices.missingName, 'позиции без названия услуги'],
        [report.prices.emptyPrice, 'позиции без цены'],
        [report.prices.zeroPrice, 'позиции с ценой «0 ₽»'],
        [report.prices.invalidPrice, 'позиции с ценой в некорректном формате'],
      ];
      const problems = problemLabels
        .filter(([list]) => list.length > 0)
        .map(([list, label]) => `${label} (${list.length}): ${formatExamples(list)}`);

      const summary = `страниц — ${pageSummaries.length} (${pageSummaries.join(', ')}), категорий — ${report.categoryCount}, позиций — ${report.itemCount}`;

      if (problems.length > 0) {
        return {
          id: this.id,
          title: this.title, pageUrl: priceUrl,
          status: 'failed',
          message: `Проверено: ${summary}. Найдено проблем: ${problems.length}. ${problems.join('; ')}.`,
          screenshot,
        };
      }

      const onRequestNote = report.onRequestCount > 0 ? `, из них ${report.onRequestCount} «по запросу»` : '';
      return {
        id: this.id,
        title: this.title, pageUrl: priceUrl,
        status: 'passed',
        message: `Прайс структурирован по категориям (${summary}). У всех позиций есть название и корректная цена в рублях${onRequestNote}.`,
        screenshot,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: priceUrl, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
