import { chromium } from '@playwright/test';

const query = 'Аллергология';
const selectors = {
  searchInput: '.page-price__wrap #search',
  submitButton: '.page-price__wrap button[type="submit"]',
  priceItem: '.spollers-cost__price',
};

export const priceFilter = {
  id: 'price-filter',
  title: 'Поиск/фильтр по прайсу на странице «Цены» работает корректно',

  async run({ url }) {
    let browser;
    const priceUrl = new URL('/price/', url).href;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(priceUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const searchInput = page.locator(selectors.searchInput).first();
      if (await searchInput.count() === 0) {
        return { id: this.id, title: this.title, pageUrl: priceUrl, status: 'failed', message: `На странице ${priceUrl} не найдено поле поиска по прайсу.` };
      }

      const itemsBefore = await page.locator(selectors.priceItem).count();

      await searchInput.fill(query);
      await page.locator(selectors.submitButton).first().click();
      await page.waitForTimeout(1_500);

      const itemsAfter = await page.locator(selectors.priceItem).count();
      const bodyText = await page.evaluate(() => document.body.innerText);
      await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      const hasQueryHeading = bodyText.toUpperCase().includes(query.toUpperCase());
      const isNarrowed = itemsAfter > 0 && itemsAfter < itemsBefore;

      if (!isNarrowed || !hasQueryHeading) {
        return {
          id: this.id,
          title: this.title, pageUrl: priceUrl,
          status: 'failed',
          message: `После поиска по запросу «${query}» список не сузился ожидаемым образом (было ${itemsBefore} позиций, стало ${itemsAfter}).`,
          screenshot,
        };
      }

      return {
        id: this.id,
        title: this.title, pageUrl: priceUrl,
        status: 'passed',
        message: `Фильтр по прайсу по запросу «${query}» сузил список с ${itemsBefore} до ${itemsAfter} позиций.`,
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
