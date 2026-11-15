import { webkit } from 'playwright';
import { errorMessage, takeScreenshot } from '../helpers/common.js';

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

function launchErrorText(error) {
  const lines = [];
  for (const line of String(error.message).split('\n')) {
    const text = line.replace(/[╔╗╚╝║═]/g, '').trim();
    if (text) lines.push(text);
  }
  return lines.join(' ').slice(0, 300);
}

async function openPage(page, url) {
  const options = { waitUntil: 'domcontentloaded', timeout: 30_000 };
  try {
    return await page.goto(url, options);
  } catch {
    return page.goto(url, options);
  }
}

async function checkPages(browser, browserTitle, siteUrl, problems, media, blockCaptcha) {
  for (const path of KEY_PAGES) {
    const url = new URL(path, siteUrl).href;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

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

async function checkPage(page, url, path, browserTitle, problems, media) {
  let response;
  try {
    response = await openPage(page, url);
  } catch (error) {
    problems.push(`${browserTitle}, ${url}: страница не открылась с двух попыток (${errorMessage(error)})`);
    return;
  }

  await page.waitForLoadState('load', { timeout: 10_000 }).catch(() => {});

  const status = response.status();
  if (status >= 400) problems.push(`${browserTitle}, ${url}: HTTP ${status}`);

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

    await checkPages(browser, 'Chromium', siteUrl, problems, media, false);

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
    const checksCount = KEY_PAGES.length * 2;

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
