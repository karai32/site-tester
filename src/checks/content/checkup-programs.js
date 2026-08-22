import { chromium } from '@playwright/test';

const selectors = {
  programLink: '.checkup-item__desc',
};
const programsToCheck = 3;
const priceOrTextPattern = /\d[\d\s]*(₽|руб)/i;

function problemMessage(problems) {
  return `Найдено проблем: ${problems.length}. ${problems.join('; ')}.`;
}

export const checkupPrograms = {
  id: 'checkup-programs',
  title: 'Список чек-ап программ и их состав отображается полностью, с ценой',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const checkupsUrl = new URL('/checkups/', url).href;
      await page.goto(checkupsUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const hrefs = await page.locator(selectors.programLink).evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))]);
      if (hrefs.length === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: `На странице ${checkupsUrl} не найдено ни одной чек-ап программы.` };
      }

      const problems = [];
      let screenshot;
      const sample = hrefs.slice(0, programsToCheck);

      for (const href of sample) {
        const target = new URL(href, url).href;
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(500);

        const bodyText = await page.evaluate(() => document.body.innerText);

        if (!screenshot) {
          const priceElement = page.getByText(priceOrTextPattern).first();
          if (await priceElement.count() > 0) {
            await priceElement.scrollIntoViewIfNeeded().catch(() => {});
          }
          const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
          screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
        }

        if (bodyText.length < 800) {
          problems.push(`${target}: слишком мало текста (${bodyText.length} символов), состав программы не описан`);
        }

        if (!priceOrTextPattern.test(bodyText)) {
          problems.push(`${target}: не найдена цена программы`);
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: `Проверено ${sample.length} из ${hrefs.length} чек-ап программ, у каждой есть описание состава и цена.`,
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
