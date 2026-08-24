import { chromium } from '@playwright/test';

const viewports = [
  { label: 'Смартфон (320×690)', width: 320, height: 690 },
  { label: 'Планшет (768×1024)', width: 768, height: 1024 },
  { label: 'Десктоп (1280×900)', width: 1280, height: 900 },
];

export const mobileAdaptiveNoScroll = {
  id: 'mobile-adaptive-no-scroll',
  title: 'Сайт корректно адаптируется на экранах смартфона и планшета, нет горизонтального скролла',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const problems = [];
      const screenshots = [];

      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(1_000);

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        if (scrollWidth > clientWidth + 1) {
          problems.push(`${viewport.label}: горизонтальный скролл есть (ширина контента ${scrollWidth}px больше экрана ${clientWidth}px)`);
        }

        await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
        const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 45, fullPage: true });
        screenshots.push({
          label: viewport.label,
          image: `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`,
        });

        await page.close();
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'passed',
          message: `Проверено на ${viewports.length} разрешениях (${viewports.map((v) => v.label).join(', ')}), горизонтального скролла нет.`,
          screenshots,
        }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}.`, problems, screenshots };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
