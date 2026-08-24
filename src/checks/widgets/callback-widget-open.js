import { chromium } from '@playwright/test';

const selectors = {
  widgetFrame: '#CalltouchWidgetFrame',
};
const maxAttempts = 3;

export const callbackWidgetOpen = {
  id: 'callback-widget-open',
  title: 'Виджет обратного звонка открывается по клику без задержек и визуальных багов',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

      let widgetFrame;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        widgetFrame = page.locator(selectors.widgetFrame);
        const appeared = await widgetFrame.waitFor({ state: 'attached', timeout: 20_000 }).then(() => true).catch(() => false);
        if (appeared) break;
      }

      if (await widgetFrame.count() === 0) {
        return {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'failed',
          message: `Виджет обратного звонка (${selectors.widgetFrame}) не появился за ${maxAttempts} попытки.`,
        };
      }

      const frame = page.frameLocator(selectors.widgetFrame);
      const button = frame.locator('button').first();

      const buttonAppeared = await button.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
      if (!buttonAppeared) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: 'Внутри виджета обратного звонка не найдена кнопка открытия.' };
      }

      await button.click();
      await page.waitForTimeout(800);

      const phoneInput = frame.locator('input').first();
      const phoneInputVisible = await phoneInput.isVisible().catch(() => false);

      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      if (!phoneInputVisible) {
        return {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'failed',
          message: 'После клика по виджету обратного звонка не появилось поле ввода телефона.',
          screenshot,
        };
      }

      return {
        id: this.id,
        title: this.title, pageUrl: url,
        status: 'passed',
        message: 'Виджет обратного звонка открывается по клику и показывает форму ввода телефона.',
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
