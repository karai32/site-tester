// Иконка онлайн-чата (Carrot quest) появляется на странице
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  chatWidget: '#carrotquest-messenger-collapsed-container',
};
const maxWaitMs = 8_000;
// Чат не показывается браузерам-роботам, поэтому представляемся обычным Chrome
const desktopUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export default {
  id: 'chat-widget-loads',
  title: 'Иконка онлайн-чата появляется в течение нескольких секунд после загрузки страницы',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, userAgent: desktopUserAgent });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const chatWidget = page.locator(selectors.chatWidget);
    await chatWidget.waitFor({ state: 'attached', timeout: maxWaitMs }).catch(() => {});
    if (await chatWidget.count() === 0) {
      return { passed: false, comment: `На странице не найден виджет чата (${selectors.chatWidget}).` };
    }

    await page.waitForTimeout(maxWaitMs);
    const { width, height } = await chatWidget.evaluate((el) => el.getBoundingClientRect());
    const media = [await takeScreenshot(page)];

    if (width > 0 && height > 0) {
      return { passed: true, comment: `Виджет чата загрузился, размер ${width}×${height}.`, media };
    }
    return {
      passed: false,
      comment: `Виджет чата не отображается за ${(maxWaitMs * 2) / 1000} сек после загрузки: размер ${width}×${height}.`,
      media,
    };
  },
};
