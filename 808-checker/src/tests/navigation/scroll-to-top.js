// Кнопка «наверх» возвращает страницу к началу. К результату прикладывается видео.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const selectors = {
  upButton: '.btn--up',
};

// Прокручивает страницу вниз, нажимает кнопку и смотрит, вернулась ли страница наверх
async function checkButton(page) {
  if (await page.locator(selectors.upButton).count() === 0) {
    return { passed: false, comment: `Не найдена кнопка «наверх» ${selectors.upButton}.` };
  }

  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(300);
  if (!(await page.evaluate(() => window.scrollY > 500))) {
    return { passed: false, comment: 'Не удалось прокрутить страницу вниз для проверки кнопки.' };
  }

  await page.evaluate((selector) => document.querySelector(selector)?.click(), selectors.upButton);
  await page.waitForTimeout(2_500);
  const scrollY = await page.evaluate(() => window.scrollY);

  return scrollY < 50
    ? { passed: true, comment: `Кнопка «наверх» вернула страницу к началу (scrollY=${scrollY}).` }
    : { passed: false, comment: `После клика по кнопке «наверх» страница не вернулась к началу (scrollY=${scrollY}).` };
}

export default {
  id: 'scroll-to-top',
  title: 'Кнопка «наверх» работает корректно',

  async run({ siteUrl, browser }) {
    // Видео пишется во временную папку и готово только после закрытия вкладки
    const videoDir = mkdtempSync(join(tmpdir(), 'scroll-to-top-'));
    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        recordVideo: { dir: videoDir, size: { width: 960, height: 600 } },
      });
      const page = await context.newPage();
      await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const result = await checkButton(page);

      await context.close();
      const video = readFileSync(await page.video().path());
      return { ...result, media: [video] };
    } finally {
      rmSync(videoDir, { recursive: true, force: true });
    }
  },
};
