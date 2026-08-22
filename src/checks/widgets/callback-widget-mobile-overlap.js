import { chromium } from '@playwright/test';

const selectors = {
  widget: '#CalltouchWidgetFrame',
};
const ctaSelectors = [
  { selector: '.btn--up', label: 'кнопка «наверх»' },
  { selector: '.nav-bottom__burger', label: 'кнопка мобильного меню' },
  { selector: 'header', label: 'шапка сайта' },
];

function boxesOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function problemMessage(problems) {
  return `Найдено проблем: ${problems.length}. ${problems.join('; ')}.`;
}

export const callbackWidgetMobileOverlap = {
  id: 'callback-widget-mobile-overlap',
  title: 'Виджет обратного звонка не перекрывает контент/CTA на мобильных',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(4_000);
      await page.mouse.wheel(0, 1_500);
      await page.waitForTimeout(1_000);

      const widget = page.locator(selectors.widget);
      if (await widget.count() === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: `Не найден виджет обратного звонка (${selectors.widget}).` };
      }

      const widgetBox = await widget.boundingBox();
      if (!widgetBox) {
        return { id: this.id, title: this.title, status: 'failed', message: 'Не удалось определить положение виджета обратного звонка.' };
      }

      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      const problems = [];

      for (const { selector, label } of ctaSelectors) {
        const box = await page.locator(selector).first().boundingBox().catch(() => null);
        if (box && boxesOverlap(widgetBox, box)) {
          problems.push(`виджет перекрывает «${label}» (${selector})`);
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: 'Виджет обратного звонка не перекрывает проверенные CTA-элементы на мобильном экране.',
          screenshot,
        }
        : { id: this.id, title: this.title, status: 'failed', message: problemMessage(problems), screenshot };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
