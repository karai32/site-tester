// Главная страница отвечает без ошибок 4xx/5xx
export default {
  id: 'homepage-http-status',
  title: 'Главная страница загружается без ошибок 4xx/5xx',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();
    const response = await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const status = response.status();

    return status >= 200 && status < 400
      ? { passed: true, comment: `Главная страница загружена. HTTP-статус: ${status}.` }
      : { passed: false, comment: `Главная страница вернула HTTP-статус ${status}.` };
  },
};
