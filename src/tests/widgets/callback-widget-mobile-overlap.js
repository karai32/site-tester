// На телефоне виджет обратного звонка не закрывает кнопки сайта
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  widget: '#CalltouchWidgetFrame',
};
const ctaSelectors = [
  { selector: '.btn--up', label: 'кнопка «наверх»' },
  { selector: '.nav-bottom__burger', label: 'кнопка мобильного меню' },
  { selector: 'header', label: 'шапка сайта' },
];

// Пересекаются ли два прямоугольника
function boxesOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export default {
  id: 'callback-widget-mobile-overlap',
  title: 'Виджет обратного звонка не перекрывает контент/CTA на мобильных',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(4_000);
    await page.mouse.wheel(0, 1_500); // после прокрутки появляется кнопка «наверх»
    await page.waitForTimeout(1_000);

    const widget = page.locator(selectors.widget);
    if (await widget.count() === 0) {
      return { passed: false, comment: `Не найден виджет обратного звонка (${selectors.widget}).` };
    }
    const widgetBox = await widget.boundingBox();
    if (!widgetBox) {
      return { passed: false, comment: 'Не удалось определить положение виджета обратного звонка.' };
    }

    const media = [await takeScreenshot(page)];
    const problems = [];
    for (const { selector, label } of ctaSelectors) {
      const box = await page.locator(selector).first().boundingBox().catch(() => null);
      if (box && boxesOverlap(widgetBox, box)) problems.push(`виджет перекрывает «${label}» (${selector})`);
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: 'Виджет обратного звонка не перекрывает проверенные CTA-элементы на мобильном экране.',
        media,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media };
  },
};
