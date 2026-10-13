// Список врачей листается: страницы 1, 2, 3 разные, номер страницы виден в адресе
import { takeScreenshot } from '../helpers/common.js';

const selectors = {
  doctorLinks: '.doctor-item a[href*="/doctors/"]',
};

async function collectDoctorLinks(page) {
  const hrefs = await page.locator(selectors.doctorLinks).evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  return [...new Set(hrefs)];
}

export default {
  id: 'doctors-pagination',
  title: 'Листание списка врачей работает корректно, URL отражает номер страницы',

  async run({ siteUrl, browser }) {
    const listUrl = new URL('/doctors/', siteUrl).href;
    const pages = [listUrl, `${listUrl}?page=2`, `${listUrl}?page=3`];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const page1 = await collectDoctorLinks(page);

    await page.goto(`${listUrl}?page=2`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const page2 = await collectDoctorLinks(page);
    const media = [await takeScreenshot(page)];

    if (!page.url().includes('page=2')) {
      return { passed: false, comment: `URL не отражает номер страницы: ${page.url()}`, media, pages };
    }
    if (page2.length === 0 || page1.every((href) => page2.includes(href))) {
      return { passed: false, comment: 'Страница 2 списка врачей пуста или полностью совпадает со страницей 1.', media, pages };
    }

    await page.goto(`${listUrl}?page=3`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const page3 = await collectDoctorLinks(page);
    if (page3.length === 0 || page2.every((href) => page3.includes(href))) {
      return { passed: false, comment: 'Страница 3 списка врачей пуста или полностью совпадает со страницей 2.', media, pages };
    }

    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const page1Again = await collectDoctorLinks(page);
    if (JSON.stringify(page1Again) !== JSON.stringify(page1)) {
      return { passed: false, comment: 'После возврата на страницу 1 список врачей отличается от исходного.', media, pages };
    }

    return { passed: true, comment: 'Страницы 1, 2 и 3 списка врачей содержат разные наборы карточек, URL отражает номер страницы, возврат на страницу 1 работает корректно.', media, pages };
  },
};
