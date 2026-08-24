import { chromium } from '@playwright/test';

const selectors = {
  doctorLinks: '.doctor-item a[href*="/doctors/"]',
};

async function collectDoctorLinks(page) {
  const hrefs = await page.locator(selectors.doctorLinks).evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  return [...new Set(hrefs)];
}

export const doctorsPagination = {
  id: 'doctors-pagination',
  title: 'Листание списка врачей работает корректно, URL отражает номер страницы',

  async run({ url }) {
    let browser;
    const listUrl = new URL('/doctors/', url).href;
    const pageUrls = [listUrl, `${listUrl}?page=2`, `${listUrl}?page=3`];

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const page1 = await collectDoctorLinks(page);

      await page.goto(`${listUrl}?page=2`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const page2 = await collectDoctorLinks(page);
      await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      if (!page.url().includes('page=2')) {
        return { id: this.id, title: this.title, status: 'failed', message: `URL не отражает номер страницы: ${page.url()}`, screenshot, pageUrls };
      }

      if (page2.length === 0 || page1.every((href) => page2.includes(href))) {
        return {
          id: this.id,
          title: this.title,
          status: 'failed',
          message: 'Страница 2 списка врачей пуста или полностью совпадает со страницей 1.',
          screenshot,
          pageUrls,
        };
      }

      await page.goto(`${listUrl}?page=3`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const page3 = await collectDoctorLinks(page);

      if (page3.length === 0 || page2.every((href) => page3.includes(href))) {
        return {
          id: this.id,
          title: this.title,
          status: 'failed',
          message: 'Страница 3 списка врачей пуста или полностью совпадает со страницей 2.',
          screenshot,
          pageUrls,
        };
      }

      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const page1Again = await collectDoctorLinks(page);

      if (JSON.stringify(page1Again) !== JSON.stringify(page1)) {
        return {
          id: this.id,
          title: this.title,
          status: 'failed',
          message: 'После возврата на страницу 1 список врачей отличается от исходного.',
          screenshot,
          pageUrls,
        };
      }

      return {
        id: this.id,
        title: this.title,
        status: 'passed',
        message: 'Страницы 1, 2 и 3 списка врачей содержат разные наборы карточек, URL отражает номер страницы, возврат на страницу 1 работает корректно.',
        screenshot,
        pageUrls,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}`, pageUrls };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
