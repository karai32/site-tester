import { PAGE_TIMEOUT_MS, errorMessage, newPageWithoutCaptcha, takeScreenshot } from '../helpers.js';

const viewports = [
  { label: 'Смартфон (320×690)', width: 320, height: 690 },
  { label: 'Планшет (768×1024)', width: 768, height: 1024 },
  { label: 'Десктоп (1280×900)', width: 1280, height: 900 },
];

const pagesToCheck = [
  { path: '/', label: 'Главная' },
  { path: '/doctors/', label: 'Список врачей' },
  { path: '/doctors/fadeev-valentin-viktorovich/', label: 'Страница врача' },
  { path: '/services/', label: 'Услуги' },
  { path: '/services/diabet-pod-kontrolem/', label: 'Страница услуги' },
  { path: '/diagnoses/', label: 'Диагнозы' },
  { path: '/knowledge/', label: 'База знаний' },
  { path: '/reviews/', label: 'Отзывы' },
  { path: '/about/', label: 'О клинике' },
  { path: '/contacts/', label: 'Контакты' },
];

export default {
  id: 'mobile-adaptive-no-scroll',
  title: 'Сайт корректно адаптируется на экранах смартфона и планшета, нет горизонтального скролла',

  async run({ siteUrl, browser }) {
    const problems = [];
    const media = [];

    for (const { path, label } of pagesToCheck) {
      const target = new URL(path, siteUrl).href;

      for (const viewport of viewports) {
        const page = await newPageWithoutCaptcha(browser, { viewport: { width: viewport.width, height: viewport.height } });
        try {
          await page.goto(target, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
          await page.waitForTimeout(1_000);

          const { scrollWidth, clientWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }));
          if (scrollWidth > clientWidth + 1) {
            problems.push(`${label} (${target}), ${viewport.label}: горизонтальный скролл есть (ширина контента ${scrollWidth}px больше экрана ${clientWidth}px)`);
          }

          media.push({ data: await takeScreenshot(page, { fullPage: true }), caption: `${label} - ${viewport.label}` });
        } catch (error) {
          problems.push(`${label} (${target}), ${viewport.label}: ${errorMessage(error)}`);
        } finally {
          await page.close().catch(() => {});
        }
      }
    }

    const pages = pagesToCheck.map(({ path }) => new URL(path, siteUrl).href);
    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${pagesToCheck.length} страниц на ${viewports.length} разрешениях (${viewports.map((v) => v.label).join(', ')}), горизонтального скролла нет.`,
        media,
        pages,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, media, pages };
  },
};
