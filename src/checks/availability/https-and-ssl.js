import { chromium } from '@playwright/test';

export const httpsAndSsl = {
  id: 'https-and-ssl',
  title: 'Сайт открывается по https, есть корректный SSL-сертификат, нет предупреждений браузера',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ ignoreHTTPSErrors: false });
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      if (!response) {
        throw new Error('браузер не получил ответ от сайта');
      }

      if (new URL(page.url()).protocol !== 'https:') {
        return { id: this.id, title: this.title, status: 'failed', message: 'Сайт открылся без HTTPS.' };
      }

      const security = await response.securityDetails();
      const protocol = security?.protocol ? ` Протокол: ${security.protocol}.` : '';
      return {
        id: this.id,
        title: this.title,
        status: 'passed',
        message: `Сайт открыт по HTTPS. Chromium принял SSL-сертификат без предупреждений.${protocol}`,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Ошибка HTTPS/SSL: ${reason}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
