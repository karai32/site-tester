import { chromium } from '@playwright/test';

const selectors = {
  section: '.h-main-licenses',
  card: '.h-license-card',
  icon: '.h-license-img-wrap img',
  title: '.h-license-title',
};

export const homepageAdvantagesBlock = {
  id: 'homepage-advantages-block',
  title: 'Блок преимуществ/лицензий на главной отображается без искажений вёрстки',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const section = page.locator(selectors.section);
      if (await section.count() === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `На главной странице не найден блок ${selectors.section}.` };
      }

      const cards = page.locator(selectors.card);
      const cardCount = await cards.count();
      if (cardCount === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: 'В блоке преимуществ/лицензий не найдено ни одной карточки.' };
      }

      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      const problems = [];

      for (let index = 0; index < cardCount; index += 1) {
        const card = cards.nth(index);
        const title = (await card.locator(selectors.title).first().textContent().catch(() => '') || '').trim();

        if (!title) {
          problems.push(`карточка №${index + 1}: не заполнен текст`);
        }

        const iconBroken = await card.locator(selectors.icon).first().evaluate((img) => !img.complete || img.naturalWidth === 0).catch(() => true);
        if (iconBroken) {
          problems.push(`карточка «${title || `№${index + 1}`}»: иконка не загрузилась`);
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'passed',
          message: `Проверено ${cardCount} карточек в блоке преимуществ/лицензий: текст и иконки отображаются корректно.`,
          screenshot,
        }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}.`, problems, screenshot };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
