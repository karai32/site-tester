import { chromium } from '@playwright/test';

const selectors = {
  chatWidget: '#carrotquest-messenger-collapsed-container',
};
const maxWaitMs = 8_000;
const desktopUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export const chatWidgetLoads = {
  id: 'chat-widget-loads',
  title: 'Иконка онлайн-чата появляется в течение нескольких секунд после загрузки страницы',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, userAgent: desktopUserAgent });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const chatWidget = page.locator(selectors.chatWidget);
      await chatWidget.waitFor({ state: 'attached', timeout: maxWaitMs }).catch(() => {});

      if (await chatWidget.count() === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `На странице не найден виджет чата (${selectors.chatWidget}).` };
      }

      await page.waitForTimeout(maxWaitMs);

      const state = await chatWidget.evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      }));

      await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      if (state.width === 0 || state.height === 0) {
        return {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'failed',
          message: `Виджет чата не отображается за ${(maxWaitMs * 2) / 1000} сек после загрузки: размер ${state.width}×${state.height}.`,
          screenshot,
        };
      }

      return {
        id: this.id,
        title: this.title, pageUrl: url,
        status: 'passed',
        message: `Виджет чата загрузился, размер ${state.width}×${state.height}.`,
        screenshot,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
