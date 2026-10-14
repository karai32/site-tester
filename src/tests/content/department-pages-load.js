// Страницы основных направлений открываются без ошибок
import { errorMessage, takeScreenshot } from '../helpers/common.js';

const departmentPaths = [
  '/departments/onkologia/',
  '/departments/urologija/',
  '/departments/serdechno-sosudistyj-czentr/',
  '/departments/hirurgija/',
  '/departments/diagnostika/',
  '/departments/mezhdunarodnaya-mediczina/',
];

export default {
  id: 'department-pages-load',
  title: 'Страницы направлений (онкология, урология, кардиология и др.) открываются без ошибок',

  async run({ siteUrl, browser }) {
    const pages = departmentPaths.map((path) => new URL(path, siteUrl).href);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const problems = [];
    const media = [];

    for (const target of pages) {
      let response;
      try {
        response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      } catch (error) {
        problems.push(`${target}: ${errorMessage(error)}`);
        continue;
      }

      const status = response.status();
      if (status < 200 || status >= 400) {
        problems.push(`${target}: HTTP ${status}`);
        continue;
      }
      // Скриншот первой открывшейся страницы
      if (media.length === 0) media.push(await takeScreenshot(page));
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${pages.length} страниц направлений, все открываются без ошибок.`,
        media,
        pages,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media, pages };
  },
};
