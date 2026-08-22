import { chromium } from '@playwright/test';

// WebKit (Safari proxy) is not usable in this environment — its network process
// fails to launch under the current sandbox. Chromium also covers Yandex Browser,
// which is Chromium-based. Add a webkit entry here if it becomes available.
const browsers = [
  { launcher: chromium, label: 'Chromium (Chrome / Yandex Browser)' },
];

const pagesToCheck = ['/', '/price/'];

function problemMessage(problems) {
  return `Найдено проблем: ${problems.length}. ${problems.join('; ')}.`;
}

export const crossBrowser = {
  id: 'cross-browser',
  title: 'Ключевые страницы и формы работают в разных браузерах',

  async run({ url }) {
    const problems = [];
    let screenshot;

    for (const { launcher, label } of browsers) {
      let browser;

      try {
        browser = await launcher.launch();
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

        for (const path of pagesToCheck) {
          const target = new URL(path, url).href;
          const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch((error) => {
            problems.push(`${label}, ${target}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
            return null;
          });

          if (!response) continue;

          const status = response.status();
          if (status < 200 || status >= 400) {
            problems.push(`${label}, ${target}: HTTP ${status}`);
          }

          if (!screenshot) {
            const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
            screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
          }
        }

        const formCount = await page.locator('form.wpcf7-form').count().catch(() => 0);
        if (formCount === 0) {
          problems.push(`${label}: на главной странице не найдено форм.`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
        problems.push(`${label}: браузер не запустился (${message})`);
      } finally {
        await browser?.close().catch(() => {});
      }
    }

    return problems.length === 0
      ? {
        id: this.id,
        title: this.title,
        status: 'passed',
        message: `Проверено в ${browsers.length} браузере(ах): ${browsers.map((b) => b.label).join(', ')}. Ключевые страницы и формы загружаются корректно.`,
        screenshot,
      }
      : { id: this.id, title: this.title, status: 'failed', message: problemMessage(problems), screenshot };
  },
};
