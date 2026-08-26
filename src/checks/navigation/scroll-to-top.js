import { chromium } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const selectors = {
  upButton: '.btn--up',
};

export const scrollToTop = {
  id: 'scroll-to-top',
  title: 'Кнопка «наверх» работает корректно',

  async run({ url }) {
    let browser;
    let videoDir;

    try {
      browser = await chromium.launch();
      videoDir = mkdtempSync(join(tmpdir(), 'scroll-to-top-'));
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        recordVideo: { dir: videoDir, size: { width: 960, height: 600 } },
      });
      const page = await context.newPage();
      const video = page.video();

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const upButton = page.locator(selectors.upButton).first();
      let outcome;

      if (await upButton.count() === 0) {
        outcome = { status: 'failed', message: `Не найдена кнопка «наверх» ${selectors.upButton}.` };
      } else {
        await page.evaluate(() => window.scrollTo(0, 3000));
        await page.waitForTimeout(300);
        const scrolledDown = await page.evaluate(() => window.scrollY > 500);

        if (!scrolledDown) {
          outcome = { status: 'failed', message: 'Не удалось прокрутить страницу вниз для проверки кнопки.' };
        } else {
          await page.evaluate((selector) => document.querySelector(selector)?.click(), selectors.upButton);
          await page.waitForTimeout(2_500);
          const scrollY = await page.evaluate(() => window.scrollY);

          outcome = scrollY < 50
            ? { status: 'passed', message: `Кнопка «наверх» вернула страницу к началу (scrollY=${scrollY}).` }
            : { status: 'failed', message: `После клика по кнопке «наверх» страница не вернулась к началу (scrollY=${scrollY}).` };
        }
      }

      await context.close();
      const videoBuffer = readFileSync(await video.path());
      outcome.video = `data:video/webm;base64,${videoBuffer.toString('base64')}`;

      return { id: this.id, title: this.title, pageUrl: url, ...outcome };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
      if (videoDir) rmSync(videoDir, { recursive: true, force: true });
    }
  },
};
