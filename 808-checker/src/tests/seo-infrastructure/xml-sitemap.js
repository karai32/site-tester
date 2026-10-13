// Карта сайта указана в robots.txt, открывается и содержит рабочие вложенные карты
import { getStatuses } from '../helpers/common.js';

export default {
  id: 'xml-sitemap',
  title: 'XML Sitemap присутствует, доступен и указан в robots.txt',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage();
    const siteOrigin = new URL(siteUrl).origin;
    const problems = [];

    // 1. robots.txt и строка Sitemap: в нём
    const robotsUrl = `${siteOrigin}/robots.txt`;
    const robotsResponse = await page.request.get(robotsUrl, { failOnStatusCode: false, timeout: 15_000 });
    const robotsStatus = robotsResponse.status();
    const robotsText = robotsStatus === 200 ? await robotsResponse.text() : '';
    await robotsResponse.dispose();

    if (robotsStatus !== 200) problems.push(`robots.txt недоступен (HTTP ${robotsStatus})`);
    const sitemapLine = robotsText.match(/^Sitemap:\s*(\S+)/im);
    if (!sitemapLine) problems.push('в robots.txt отсутствует строка "Sitemap:" со ссылкой на карту сайта');

    // 2. Сама карта сайта
    const sitemapUrl = sitemapLine ? sitemapLine[1] : `${siteOrigin}/sitemap.xml`;
    const sitemapResponse = await page.request.get(sitemapUrl, { failOnStatusCode: false, timeout: 15_000 });
    const sitemapStatus = sitemapResponse.status();
    const sitemapType = sitemapResponse.headers()['content-type'] || '';
    const sitemapText = sitemapStatus === 200 ? await sitemapResponse.text() : '';
    await sitemapResponse.dispose();

    if (sitemapStatus !== 200) {
      problems.push(`${sitemapUrl}: карта сайта недоступна (HTTP ${sitemapStatus})`);
    } else if (!sitemapType.includes('xml')) {
      problems.push(`${sitemapUrl}: ответ не является XML (content-type: ${sitemapType})`);
    } else if (!/<sitemapindex\b|<urlset\b/i.test(sitemapText)) {
      problems.push(`${sitemapUrl}: в содержимом нет тега <sitemapindex> или <urlset>`);
    } else if (/<sitemapindex\b/i.test(sitemapText)) {
      // 3. Индекс карт: каждая вложенная карта должна открываться
      const subSitemapUrls = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim());
      if (subSitemapUrls.length === 0) problems.push(`${sitemapUrl}: индекс карт сайта пуст`);

      for (const [subUrl, { status, error }] of await getStatuses(subSitemapUrls)) {
        if (status !== 200) problems.push(`${subUrl}: недоступна (HTTP ${status}${error ? `, ${error}` : ''})`);
      }
    }

    return problems.length === 0
      ? { passed: true, comment: `Карта сайта доступна (${sitemapUrl}) и указана в robots.txt.`, pages: [robotsUrl, sitemapUrl] }
      : { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems, pages: [robotsUrl, sitemapUrl] };
  },
};
