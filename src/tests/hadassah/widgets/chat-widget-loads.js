import { PAGE_TIMEOUT_MS, takeScreenshot } from '../helpers.js';

const selectors = {
  chatWidget: '#carrotquest-messenger-collapsed-container',
};
const maxWaitMs = 30_000;
const desktopUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export default {
  id: 'chat-widget-loads',
  title: 'Иконка онлайн-чата появляется в течение нескольких секунд после загрузки страницы',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, userAgent: desktopUserAgent });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

    const loadedAt = Date.now();

    const shown = await page.waitForFunction((selector) => {
      const widget = document.querySelector(selector);
      if (!widget) return false;
      const { width, height } = widget.getBoundingClientRect();
      return width > 0 && height > 0;
    }, selectors.chatWidget, { timeout: maxWaitMs }).then(() => true).catch(() => false);
    const seconds = Math.round((Date.now() - loadedAt) / 1000);

    if (shown) {
      await page.waitForTimeout(1_000);
      return {
        passed: true,
        comment: `Виджет чата появился через ${seconds} с после загрузки страницы.`,
        media: [await takeScreenshot(page)],
      };
    }

    const media = [await takeScreenshot(page)];
    if (await page.locator(selectors.chatWidget).count() === 0) {
      return {
        passed: false,
        comment: `Виджет чата (${selectors.chatWidget}) не появился на странице за ${maxWaitMs / 1000} с после загрузки.`,
        media,
      };
    }
    return {
      passed: false,
      comment: `Виджет чата есть на странице, но не отображается за ${maxWaitMs / 1000} с после загрузки: у него нулевой размер.`,
      media,
    };
  },
};
