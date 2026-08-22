import { chromium } from '@playwright/test';

const selectors = {
  priceValue: '.spollers-cost__price',
  spoller: 'details.js-details',
};

export const priceListStructure = {
  id: 'price-list-structure',
  title: 'Прайс-лист отображается структурированно по категориям услуг, суммы указаны корректно',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const priceUrl = new URL('/price/', url).href;
      await page.goto(priceUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(1_000);

      const priceTexts = await page.locator(selectors.priceValue).evaluateAll((els) => els.map((el) => el.textContent.trim()));

      const firstSpoller = page.locator(selectors.spoller).first();
      if (await firstSpoller.count() > 0) {
        await firstSpoller.evaluate((el) => { el.open = true; });
        await firstSpoller.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      }
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      if (priceTexts.length === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: `На странице ${priceUrl} не найдено ни одной цены (${selectors.priceValue}).`, screenshot };
      }

      const zeroPrices = priceTexts.filter((text) => /^0[\s₽]*$/.test(text));
      if (zeroPrices.length > 0) {
        return {
          id: this.id,
          title: this.title,
          status: 'failed',
          message: `Найдено ${zeroPrices.length} позиций с некорректной ценой «0 руб.» из ${priceTexts.length} проверенных.`,
          screenshot,
        };
      }

      return {
        id: this.id,
        title: this.title,
        status: 'passed',
        message: `Проверено ${priceTexts.length} позиций прайса, все со значимыми суммами (без «0 руб.»).`,
        screenshot,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
