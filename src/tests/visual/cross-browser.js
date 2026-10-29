// Ключевые страницы сайта открываются в Chromium (движок Chrome и Яндекс Браузера)
// и в WebKit (движок Safari). На каждую страницу в каждом браузере в отчёт кладётся
// скриншот первого экрана.
import { webkit } from 'playwright';
import { errorMessage, takeScreenshot } from '../helpers/common.js';

// Ключевые страницы: главная, цены и основные разделы сайта
const KEY_PAGES = [
  '/',
  '/price/',
  '/doctors/',
  '/all-services/',
  '/services/',
  '/checkups/',
  '/programs/',
  '/diseases/',
  '/reviews/',
  '/news/',
  '/article/',
];

// Почему браузер не запустился, одной строкой. Playwright пишет причину в несколько строк
// внутри рамки из спецсимволов, рамку убираем.
function launchErrorText(error) {
  const lines = [];
  for (const line of String(error.message).split('\n')) {
    const text = line.replace(/[╔╗╚╝║═]/g, '').trim();
    if (text) lines.push(text);
  }
  return lines.join(' ').slice(0, 300);
}

// Открывает страницу. Если не получилось (например, сайт не ответил за 30 секунд), пробует второй раз:
// разовые задержки сети не должны проваливать проверку.
async function openPage(page, url) {
  const options = { waitUntil: 'domcontentloaded', timeout: 30_000 };
  try {
    return await page.goto(url, options);
  } catch {
    return page.goto(url, options);
  }
}

// Открывает ключевые страницы в браузере browser. Ошибки и скриншоты добавляет в problems и media.
// blockCaptcha: не загружать капчу Яндекса (нужно для WebKit, см. ниже).
// Каждая страница открывается в своей вкладке, и вкладка сразу закрывается: на сервере мало памяти,
// а если держать одну вкладку, память копится от страницы к странице и браузер падает.
async function checkPages(browser, browserTitle, siteUrl, problems, media, blockCaptcha) {
  for (const path of KEY_PAGES) {
    const url = new URL(path, siteUrl).href;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    // Капча Яндекса в WebKit на сервере проверки бесконечно опрашивает свой сервер, и страница
    // так и не догружается, а без этого не снять скриншот. Так капча ведёт себя с автоматическим
    // браузером, у посетителей с Safari такого нет. На первом экране капчи не видно, поэтому
    // в WebKit её просто не загружаем.
    if (blockCaptcha) {
      await page.route('https://smartcaptcha.cloud.yandex.ru/**', (route) => route.abort());
    }

    try {
      await checkPage(page, url, path, browserTitle, problems, media);
    } finally {
      await page.context().close();
    }
  }
}

// Одна страница: открыть, дождаться загрузки, проверить ответ, снять скриншот
async function checkPage(page, url, path, browserTitle, problems, media) {
  let response;
  try {
    response = await openPage(page, url);
  } catch (error) {
    problems.push(`${browserTitle}, ${url}: страница не открылась с двух попыток (${errorMessage(error)})`);
    return;
  }

  // Даём догрузиться стилям и картинкам, но не дольше 10 секунд
  await page.waitForLoadState('load', { timeout: 10_000 }).catch(() => {});

  const status = response.status();
  if (status >= 400) problems.push(`${browserTitle}, ${url}: HTTP ${status}`);

  // Скриншот и для страницы с ошибкой: по нему видно, что показалось посетителю
  try {
    media.push({ data: await takeScreenshot(page), caption: `${browserTitle}: ${path}` });
  } catch (error) {
    problems.push(`${browserTitle}, ${url}: не удалось снять скриншот (${errorMessage(error)})`);
  }
}

export default {
  id: 'cross-browser',
  title: 'Ключевые страницы и формы работают в разных браузерах',

  async run({ siteUrl, browser }) {
    const problems = [];
    const media = [];

    // Chromium: общий браузер проверки, его закрывает раннер
    await checkPages(browser, 'Chromium', siteUrl, problems, media, false);

    // Safari: WebKit запускаем сами и сами закрываем
    let safari = null;
    try {
      safari = await webkit.launch();
    } catch (error) {
      problems.push(`Safari (WebKit) не запустился: ${launchErrorText(error)}`);
    }
    if (safari) {
      try {
        await checkPages(safari, 'Safari (WebKit)', siteUrl, problems, media, true);
      } finally {
        await safari.close();
      }
    }

    const pages = KEY_PAGES.map((path) => new URL(path, siteUrl).href);
    const checksCount = KEY_PAGES.length * 2; // каждая страница в двух браузерах

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Все ключевые страницы (${KEY_PAGES.length}) открываются в Chromium и Safari (WebKit). Приложены скриншоты первого экрана.`,
        media,
        pages,
      };
    }
    return {
      passed: false,
      comment: `Найдено проблем: ${problems.length} (проверено открытий страниц: ${checksCount}).`,
      problems,
      media,
      pages,
    };
  },
};
