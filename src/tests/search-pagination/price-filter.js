// Поиск по прайсу на странице «Цены» сужает список услуг
import { takeScreenshot } from '../helpers/common.js';

const query = 'Аллергология';
const selectors = {
  searchInput: '.page-price__wrap #search',
  submitButton: '.page-price__wrap button[type="submit"]',
  priceItem: '.spollers-cost__price',
};

export default {
  id: 'price-filter',
  title: 'Поиск/фильтр по прайсу на странице «Цены» работает корректно',

  async run({ siteUrl, browser }) {
    const priceUrl = new URL('/price/', siteUrl).href;
    const pages = [priceUrl];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(priceUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const searchInput = page.locator(selectors.searchInput).first();
    if (await searchInput.count() === 0) {
      return { passed: false, comment: `На странице ${priceUrl} не найдено поле поиска по прайсу.`, pages };
    }

    const itemsBefore = await page.locator(selectors.priceItem).count();
    await searchInput.fill(query);
    await page.locator(selectors.submitButton).first().click();
    await page.waitForTimeout(1_500);

    const itemsAfter = await page.locator(selectors.priceItem).count();
    const bodyText = await page.evaluate(() => document.body.innerText);
    const media = [await takeScreenshot(page)];

    // После поиска список короче, а на странице есть заголовок с запросом
    const hasQueryHeading = bodyText.toUpperCase().includes(query.toUpperCase());
    const isNarrowed = itemsAfter > 0 && itemsAfter < itemsBefore;

    if (isNarrowed && hasQueryHeading) {
      return {
        passed: true,
        comment: `Фильтр по прайсу по запросу «${query}» сузил список с ${itemsBefore} до ${itemsAfter} позиций.`,
        media,
        pages,
      };
    }
    return {
      passed: false,
      comment: `После поиска по запросу «${query}» список не сузился ожидаемым образом (было ${itemsBefore} позиций, стало ${itemsAfter}).`,
      media,
      pages,
    };
  },
};
