import { chromium } from '@playwright/test';
import { fetchPagesContent } from '../../site-crawler.js';

export const yandexSmartcaptcha = {
  id: 'yandex-smartcaptcha',
  title: 'Yandex SmartCaptcha подключена на всех страницах, где есть формы',

  async run({ url, htmlPages: pages, pagesTruncated, pagesError }) {
    if (pagesError) {
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: не удалось получить список страниц сайта (${pagesError})` };
    }

    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext();

      const problems = [];
      let pagesWithForms = 0;

      for await (const [pageUrl, { html }] of fetchPagesContent(context.request, pages)) {
        if (!html || !/<form\b/i.test(html)) continue;
        pagesWithForms += 1;
        if (!/smartcaptcha\.cloud\.yandex\.ru\/captcha\.js/i.test(html)) {
          problems.push(`${pageUrl}: на странице есть форма, но скрипт Yandex SmartCaptcha не найден`);
        }
      }

      const truncatedNote = pagesTruncated ? ' Внимание: список страниц обрезан предохранителем обхода, реальных страниц может быть больше.' : '';

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Проверено ${pagesWithForms} HTML-страниц(ы) с формами, скрипт SmartCaptcha подключён везде.${truncatedNote}` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}. Проверено ${pagesWithForms} страниц(ы) с формами.${truncatedNote}`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
