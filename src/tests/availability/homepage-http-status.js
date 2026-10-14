// Главная страница отвечает без ошибок 4xx/5xx
export default {
  id: 'homepage-http-status',
  title: 'Главная страница загружается без ошибок 4xx/5xx',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();
    const response = await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const status = response.status();

    if (status >= 200 && status < 400) {
      return { passed: true, comment: `Главная страница загружена. HTTP-статус: ${status}.` };
    }
    return { passed: false, comment: `Главная страница вернула HTTP-статус ${status}.` };
  },
};
