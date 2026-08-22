import { chromium } from '@playwright/test';

const departmentPaths = [
  '/departments/onkologia/',
  '/departments/urologija/',
  '/departments/serdechno-sosudistyj-czentr/',
  '/departments/hirurgija/',
  '/departments/diagnostika/',
  '/departments/mezhdunarodnaya-mediczina/',
];

function problemMessage(problems) {
  return `Найдено проблем: ${problems.length}. ${problems.join('; ')}.`;
}

export const departmentPagesLoad = {
  id: 'department-pages-load',
  title: 'Страницы направлений (онкология, урология, кардиология и др.) открываются без ошибок',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

      const problems = [];
      let screenshot;

      for (const path of departmentPaths) {
        const target = new URL(path, url).href;
        const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch((error) => {
          problems.push(`${target}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
          return null;
        });

        if (!response) continue;

        const status = response.status();
        if (status < 200 || status >= 400) {
          problems.push(`${target}: HTTP ${status}`);
          continue;
        }

        if (!screenshot) {
          const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
          screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: `Проверено ${departmentPaths.length} страниц направлений, все открываются без ошибок.`,
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
