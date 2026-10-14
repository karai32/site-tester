// Чек-ап программы: у первых трёх есть описание состава и цена
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  programLink: '.checkup-item__desc',
};
const programsToCheck = 3;
const pricePattern = /\d[\d\s]*(₽|руб)/i;

export default {
  id: 'checkup-programs',
  title: 'Список чек-ап программ и их состав отображается полностью, с ценой',

  async run({ siteUrl, browser }) {
    const checkupsUrl = new URL('/checkups/', siteUrl).href;
    const pages = [checkupsUrl];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(checkupsUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const hrefs = await page.locator(selectors.programLink).evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))]);
    if (hrefs.length === 0) {
      return {
        passed: false,
        comment: `На странице ${checkupsUrl} не найдено ни одной чек-ап программы.`,
        pages,
      };
    }

    const problems = [];
    const media = [];
    const sample = hrefs.slice(0, programsToCheck);

    for (const href of sample) {
      const target = new URL(href, siteUrl).href;
      pages.push(target);
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(500);
      const bodyText = await page.evaluate(() => document.body.innerText);

      // Скриншот первой программы, прокрученный к цене
      if (media.length === 0) {
        const priceElement = page.getByText(pricePattern).first();
        if (await priceElement.count() > 0) await priceElement.scrollIntoViewIfNeeded().catch(() => {});
        media.push(await takeScreenshot(page));
      }

      if (bodyText.length < 800) {
        problems.push(`${target}: слишком мало текста (${bodyText.length} символов), состав программы не описан`);
      }
      if (!pricePattern.test(bodyText)) {
        problems.push(`${target}: не найдена цена программы`);
      }
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${sample.length} из ${hrefs.length} чек-ап программ, у каждой есть описание состава и цена.`,
        media,
        pages,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media, pages };
  },
};
