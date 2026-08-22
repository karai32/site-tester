import { chromium } from '@playwright/test';

const selectors = {
  card: '.doctor-item',
  photo: '.doctor-item__img',
  about: '.doctor-item__about',
  appointmentButton: '.doctor-item__link',
};

function problemMessage(problems) {
  const visible = problems.slice(0, 8).join('; ');
  const rest = problems.length > 8 ? `; ещё ${problems.length - 8}` : '';
  return `Найдено проблем: ${problems.length}. ${visible}${rest}.`;
}

export const doctorsHomepageBlock = {
  id: 'doctors-homepage-block',
  title: 'Блок с врачами на главной отображается с фото, должностью, кнопка записи кликабельна',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const cards = page.locator(selectors.card);
      const cardCount = await cards.count();

      if (cardCount === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: 'На главной странице не найдено ни одной карточки врача.' };
      }

      await cards.first().scrollIntoViewIfNeeded();
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      const problems = [];
      const checkedCount = Math.min(cardCount, 8);

      for (let index = 0; index < checkedCount; index += 1) {
        const card = cards.nth(index);
        const name = (await card.locator('h3').first().textContent().catch(() => '') || `№${index + 1}`).trim();

        const imgBroken = await card.locator(selectors.photo).first().evaluate((img) => !img.complete || img.naturalWidth === 0).catch(() => true);
        if (imgBroken) {
          problems.push(`«${name}»: фото не загрузилось`);
        }

        const aboutText = (await card.locator(selectors.about).first().textContent().catch(() => '') || '').trim();
        if (!aboutText) {
          problems.push(`«${name}»: не указана должность/специализация`);
        }

        const button = card.locator(selectors.appointmentButton).first();
        const buttonVisible = await button.isVisible().catch(() => false);
        const buttonEnabled = await button.isEnabled().catch(() => false);
        if (!buttonVisible || !buttonEnabled) {
          problems.push(`«${name}»: кнопка записи не кликабельна`);
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: `Проверено ${checkedCount} из ${cardCount} карточек врачей: фото загружаются, должность указана, кнопка записи кликабельна.`,
          screenshot,
        }
        : { id: this.id, title: this.title, status: 'failed', message: problemMessage(problems), screenshot };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
