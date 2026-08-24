import { chromium } from '@playwright/test';

const selectors = {
  cardNameLink: '.doctor-item__name a',
  heroName: '.doctor-hero__name',
  heroPosition: '.doctor-hero__pos',
  heroProfession: '.doctor-hero__prof',
  heroCost: '.doctor-hero__cost',
  heroButton: '.doctor-hero__button',
};

export const doctorProfileOpen = {
  id: 'doctor-profile-open',
  title: 'Открытие полной страницы врача из карточки со всеми данными',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const cardLink = page.locator(selectors.cardNameLink).first();
      if (await cardLink.count() === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: 'На главной странице не найдено ни одной карточки врача с именем-ссылкой.', pageUrl: url };
      }

      const href = await cardLink.getAttribute('href');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        cardLink.evaluate((link) => link.click()),
      ]);

      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      const problems = [];
      const checks = [
        [selectors.heroName, 'имя врача'],
        [selectors.heroPosition, 'должность'],
        [selectors.heroProfession, 'описание/квалификация'],
        [selectors.heroCost, 'стоимость приёма'],
      ];

      for (const [selector, label] of checks) {
        const text = (await page.locator(selector).first().textContent().catch(() => '') || '').trim();
        if (!text) {
          problems.push(`не заполнено поле «${label}» (${selector})`);
        }
      }

      const appointmentButton = page.locator(selectors.heroButton).first();
      const buttonVisible = await appointmentButton.isVisible().catch(() => false);
      if (!buttonVisible) {
        problems.push('кнопка записи на приём не видна');
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title,
          status: 'passed',
          message: `Страница врача (${href}) открылась из карточки, содержит должность, описание, стоимость приёма и кнопку записи.`,
          screenshot,
          pageUrls: [url, href],
        }
        : { id: this.id, title: this.title, status: 'failed', message: `Найдено проблем: ${problems.length}.`, problems, screenshot, pageUrls: [url, href] };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}`, pageUrl: url };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
