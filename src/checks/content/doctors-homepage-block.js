import { chromium } from '@playwright/test';

const selectors = {
  card: '.doctor-item',
  photo: '.doctor-item__img',
  about: '.doctor-item__about',
  appointmentButton: '.doctor-item__link',
};
const hideNuisancePopupsCss = '.modal.js-modal.--open:not(#call) { display: none !important; }';

export const doctorsHomepageBlock = {
  id: 'doctors-homepage-block',
  title: 'Блок с врачами на главной отображается с фото, должностью, кнопка записи кликабельна',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const cards = page.locator(selectors.card);
      const cardCount = await cards.count();

      if (cardCount === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: 'На главной странице не найдено ни одной карточки врача.' };
      }

      const problems = [];
      const checkedCount = Math.min(cardCount, 8);

      for (let index = 0; index < checkedCount; index += 1) {
        const card = cards.nth(index);
        const name = (await card.locator('h3').first().textContent().catch(() => '') || `№${index + 1}`).trim();

        // Читаем src из разметки напрямую и проверяем HTTP-статусом — картинка лениво
        // грузится в каруселе (swiper), и дожидаться её рендера в DOM ненадёжно.
        const photoSrc = await card.locator(selectors.photo).first().getAttribute('src').catch(() => null);
        if (!photoSrc) {
          problems.push(`«${name}»: у фото нет src`);
        } else {
          try {
            const response = await context.request.get(new URL(photoSrc, url).href, { failOnStatusCode: false, timeout: 15_000 });
            const status = response.status();
            await response.dispose();
            if (status < 200 || status >= 400) {
              problems.push(`«${name}»: фото не загрузилось (HTTP ${status})`);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
            problems.push(`«${name}»: фото не загрузилось (${message})`);
          }
        }

        const aboutText = (await card.locator(selectors.about).first().textContent().catch(() => '') || '').trim();
        if (!aboutText) {
          problems.push(`«${name}»: не указана должность/специализация`);
        }

        const button = card.locator(selectors.appointmentButton).first();
        if (await button.count() > 0) {
          const buttonVisible = await button.isVisible().catch(() => false);
          const buttonEnabled = await button.isEnabled().catch(() => false);
          if (!buttonVisible || !buttonEnabled) {
            problems.push(`«${name}»: кнопка записи не кликабельна`);
          }
        }
      }

      await cards.first().scrollIntoViewIfNeeded();
      await page.addStyleTag({ content: hideNuisancePopupsCss }).catch(() => {});
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'passed',
          message: `Проверено ${checkedCount} из ${cardCount} карточек врачей: фото загружаются, должность указана, кнопка записи (где есть) кликабельна.`,
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
