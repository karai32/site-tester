import { chromium } from '@playwright/test';

const selectors = {
  dropdownButtons: '.nav > .nav-item.menu-item-has-children > .nav-button',
};

function cleanText(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function problemMessage(problems) {
  const visible = problems.slice(0, 8).join('; ');
  const rest = problems.length > 8 ? `; ещё ${problems.length - 8}` : '';
  return `Найдено проблем: ${problems.length}. ${visible}${rest}.`;
}

export const dropdownSubmenu = {
  id: 'dropdown-submenu',
  title: 'Выпадающие подменю (направления/отделения) раскрываются корректно',

  async run({ url }) {
    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext({
        ignoreHTTPSErrors: false,
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const problems = [];
      const dropdownButtons = page.locator(selectors.dropdownButtons);
      const dropdownCount = await dropdownButtons.count();

      if (dropdownCount === 0) {
        return { id: this.id, title: this.title, status: 'failed', message: 'На странице не найдено ни одного выпадающего пункта меню.' };
      }

      for (let index = 0; index < dropdownCount; index += 1) {
        const button = dropdownButtons.nth(index);
        const name = cleanText(await button.textContent() || `№${index + 1}`);

        try {
          await button.click();
          const panel = button.locator('xpath=..').locator(':scope > .mega, :scope > .mega-mini');
          await panel.waitFor({ state: 'visible', timeout: 2_000 });
          await panel.locator('a[href]:visible').first().click({ trial: true });
          await button.click();
          await panel.waitFor({ state: 'hidden', timeout: 2_000 });
        } catch {
          problems.push(`не удалось раскрыть/закрыть подменю «${name}»`);
          await page.keyboard.press('Escape');
        }
      }

      return problems.length === 0
        ? { id: this.id, title: this.title, status: 'passed', message: `Проверено ${dropdownCount} выпадающих подменю, все раскрываются и закрываются корректно.` }
        : { id: this.id, title: this.title, status: 'failed', message: problemMessage(problems) };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
