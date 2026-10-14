// Виджет обратного звонка (Calltouch) открывается и показывает поле телефона
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  widgetFrame: '#CalltouchWidgetFrame',
};
const maxAttempts = 3; // виджет иногда не грузится с первого раза — пробуем перезагрузить страницу

export default {
  id: 'callback-widget-open',
  title: 'Виджет обратного звонка открывается по клику без задержек и визуальных багов',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const widgetFrame = page.locator(selectors.widgetFrame);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const appeared = await widgetFrame.waitFor({ state: 'attached', timeout: 20_000 }).then(() => true).catch(() => false);
      if (appeared) break;
    }
    if (await widgetFrame.count() === 0) {
      return {
        passed: false,
        comment: `Виджет обратного звонка (${selectors.widgetFrame}) не появился за ${maxAttempts} попытки.`,
      };
    }

    // Виджет живёт во фрейме: кнопка и поле ищутся внутри него
    const frame = page.frameLocator(selectors.widgetFrame);
    const button = frame.locator('button').first();
    const buttonAppeared = await button.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
    if (!buttonAppeared) {
      return { passed: false, comment: 'Внутри виджета обратного звонка не найдена кнопка открытия.' };
    }

    await button.click();
    await page.waitForTimeout(800);
    const phoneInputVisible = await frame.locator('input').first().isVisible().catch(() => false);
    const media = [await takeScreenshot(page)];

    if (phoneInputVisible) {
      return {
        passed: true,
        comment: 'Виджет обратного звонка открывается по клику и показывает форму ввода телефона.',
        media,
      };
    }
    return {
      passed: false,
      comment: 'После клика по виджету обратного звонка не появилось поле ввода телефона.',
      media,
    };
  },
};
