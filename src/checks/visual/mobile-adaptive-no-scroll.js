import { chromium } from '@playwright/test';
import { errorMessage, captureScreenshot } from '../general.js';

const viewports = [
  { label: 'Смартфон (320×690)', width: 320, height: 690 },
  { label: 'Планшет (768×1024)', width: 768, height: 1024 },
  { label: 'Десктоп (1280×900)', width: 1280, height: 900 },
];

const pagesToCheck = [
  { path: '/', label: 'Главная' },
  { path: '/price/', label: 'Цены' },
  { path: '/o-hadassah-medical-skolkovo/kontakty/', label: 'Контакты' },
  { path: '/departments/mezhdunarodnaya-mediczina/', label: 'Направление «Международная медицина»' },
  { path: '/checkups/', label: 'Чек-апы' },
  { path: '/departments/himioterapiia/', label: 'Направление «Химиотерапия»' },
  { path: '/doctors/', label: 'Список врачей' },
  { path: '/doctors/gornastolev-dmitrij-igorevich/', label: 'Страница врача' },
  { path: '/departments/kt/', label: 'Направление «КТ»' },
  { path: '/kontrol-kachestva-i-bezopasnost/', label: 'Контроль качества и безопасность' },
];

export const mobileAdaptiveNoScroll = {
  id: 'mobile-adaptive-no-scroll',
  title: 'Сайт корректно адаптируется на экранах смартфона и планшета, нет горизонтального скролла',

  async run({ url }) {
    let browser;
    const pageUrls = pagesToCheck.map(({ path }) => new URL(path, url).href);

    try {
      browser = await chromium.launch();
      const problems = [];
      const screenshots = [];

      for (const { path, label } of pagesToCheck) {
        const target = new URL(path, url).href;

        for (const viewport of viewports) {
          const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });

          try {
            await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
            await page.waitForTimeout(1_000);

            const { scrollWidth, clientWidth } = await page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
            }));

            if (scrollWidth > clientWidth + 1) {
              problems.push(`${label} (${target}), ${viewport.label}: горизонтальный скролл есть (ширина контента ${scrollWidth}px больше экрана ${clientWidth}px)`);
            }

            screenshots.push({
              label: `${label} — ${viewport.label}`,
              image: await captureScreenshot(page, { fullPage: true }),
            });
          } catch (error) {
            problems.push(`${label} (${target}), ${viewport.label}: ${errorMessage(error)}`);
          } finally {
            await page.close().catch(() => {});
          }
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: `Проверено ${pagesToCheck.length} страниц на ${viewports.length} разрешениях (${viewports.map((v) => v.label).join(', ')}), горизонтального скролла нет.`,
          screenshots,
          pageUrls,
        }
        : { id: this.id, title: this.title, status: 'failed', message: `Найдено проблем: ${problems.length}.`, problems, screenshots, pageUrls };
    } catch (error) {
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${errorMessage(error)}`, pageUrls };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
