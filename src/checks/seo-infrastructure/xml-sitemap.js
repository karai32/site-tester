import { chromium } from '@playwright/test';

export const xmlSitemap = {
  id: 'xml-sitemap',
  title: 'XML Sitemap присутствует, доступен и указан в robots.txt',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext();
      const siteOrigin = new URL(url).origin;
      const problems = [];

      const robotsUrl = `${siteOrigin}/robots.txt`;
      const robotsResponse = await context.request.get(robotsUrl, { failOnStatusCode: false, timeout: 15_000 });
      const robotsStatus = robotsResponse.status();
      const robotsText = robotsStatus === 200 ? await robotsResponse.text() : '';
      await robotsResponse.dispose();

      if (robotsStatus !== 200) {
        problems.push(`robots.txt недоступен (HTTP ${robotsStatus})`);
      }

      const sitemapLineMatch = robotsText.match(/^Sitemap:\s*(\S+)/im);
      if (!sitemapLineMatch) {
        problems.push('в robots.txt отсутствует строка "Sitemap:" со ссылкой на карту сайта');
      }

      const sitemapUrl = sitemapLineMatch ? sitemapLineMatch[1] : `${siteOrigin}/sitemap.xml`;
      const sitemapResponse = await context.request.get(sitemapUrl, { failOnStatusCode: false, timeout: 15_000 });
      const sitemapStatus = sitemapResponse.status();
      const sitemapContentType = sitemapResponse.headers()['content-type'] || '';
      const sitemapText = sitemapStatus === 200 ? await sitemapResponse.text() : '';
      await sitemapResponse.dispose();

      if (sitemapStatus !== 200) {
        problems.push(`${sitemapUrl}: карта сайта недоступна (HTTP ${sitemapStatus})`);
      } else if (!sitemapContentType.includes('xml')) {
        problems.push(`${sitemapUrl}: ответ не является XML (content-type: ${sitemapContentType})`);
      } else if (!/<sitemapindex\b|<urlset\b/i.test(sitemapText)) {
        problems.push(`${sitemapUrl}: в содержимом нет тега <sitemapindex> или <urlset>`);
      } else if (/<sitemapindex\b/i.test(sitemapText)) {
        const subSitemapUrls = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());

        if (subSitemapUrls.length === 0) {
          problems.push(`${sitemapUrl}: индекс карт сайта пуст`);
        } else {
          const results = await Promise.all(subSitemapUrls.map(async (subUrl) => {
            try {
              const response = await context.request.get(subUrl, { failOnStatusCode: false, timeout: 15_000 });
              const status = response.status();
              await response.dispose();
              return { subUrl, status };
            } catch (error) {
              const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
              return { subUrl, status: 0, error: message };
            }
          }));

          for (const result of results) {
            if (result.status !== 200) {
              problems.push(`${result.subUrl}: недоступна (HTTP ${result.status}${result.error ? `, ${result.error}` : ''})`);
            }
          }
        }
      }

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `Карта сайта доступна (${sitemapUrl}) и указана в robots.txt.` }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}.`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
