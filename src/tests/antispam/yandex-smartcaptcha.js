// На каждой странице выборки с формой подключён скрипт Yandex SmartCaptcha
export default {
  id: 'yandex-smartcaptcha',
  title: 'Yandex SmartCaptcha подключена на всех страницах, где есть формы',

  async run({ pages, getHtml }) {
    const problems = [];
    let pagesWithForms = 0;

    for (const pageUrl of pages) {
      const html = getHtml(pageUrl);
      if (!/<form\b/i.test(html)) continue;
      pagesWithForms += 1;
      if (!/smartcaptcha\.cloud\.yandex\.ru\/captcha\.js/i.test(html)) {
        problems.push(`${pageUrl}: на странице есть форма, но скрипт Yandex SmartCaptcha не найден`);
      }
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${pagesWithForms} HTML-страниц(ы) с формами, скрипт SmartCaptcha подключён везде.`,
      };
    }
    return {
      passed: false,
      comment: `Найдено проблем: ${problems.length}. Проверено ${pagesWithForms} страниц(ы) с формами.`,
      problems,
    };
  },
};
