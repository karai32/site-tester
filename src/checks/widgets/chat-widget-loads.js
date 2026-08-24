import { chromium } from '@playwright/test';

const selectors = {
  chatFrame: '#__threadswidget_chat__iframe',
};
const maxWaitMs = 8_000;

export const chatWidgetLoads = {
  id: 'chat-widget-loads',
  title: 'Иконка онлайн-чата появляется в течение нескольких секунд после загрузки страницы',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const chatFrame = page.locator(selectors.chatFrame);
      await chatFrame.waitFor({ state: 'attached', timeout: maxWaitMs }).catch(() => {});

      if (await chatFrame.count() === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `На странице не найден виджет чата (${selectors.chatFrame}).` };
      }

      await page.waitForTimeout(maxWaitMs);

      const state = await chatFrame.evaluate((el) => ({
        src: el.getAttribute('src') || '',
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      }));

      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      if (!state.src || state.width === 0 || state.height === 0) {
        return {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'failed',
          message: `Виджет чата не загрузился за ${maxWaitMs / 1000} сек: src="${state.src}", размер ${state.width}×${state.height}.`,
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
