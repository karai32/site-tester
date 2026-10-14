// Выпадающие подменю в шапке открываются и закрываются
const selectors = {
  dropdownButtons: '.nav > .nav-item.menu-item-has-children > .nav-button',
};

function cleanText(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

export default {
  id: 'dropdown-submenu',
  title: 'Выпадающие подменю (направления/отделения) раскрываются корректно',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const dropdownButtons = page.locator(selectors.dropdownButtons);
    const dropdownCount = await dropdownButtons.count();
    if (dropdownCount === 0) {
      return { passed: false, comment: 'На странице не найдено ни одного выпадающего пункта меню.' };
    }

    const problems = [];
    for (let index = 0; index < dropdownCount; index += 1) {
      const button = dropdownButtons.nth(index);
      const name = cleanText(await button.textContent() || `№${index + 1}`);

      try {
        await button.click();
        const panel = button.locator('xpath=..').locator(':scope > .mega, :scope > .mega-mini');
        await panel.waitFor({ state: 'visible', timeout: 2_000 });
        await panel.locator('a[href]:visible').first().click({ trial: true }); // ссылка в подменю кликабельна
        await button.click();
        await panel.waitFor({ state: 'hidden', timeout: 2_000 });
      } catch {
        problems.push(`не удалось раскрыть/закрыть подменю «${name}»`);
        await page.keyboard.press('Escape');
      }
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${dropdownCount} выпадающих подменю, все раскрываются и закрываются корректно.`,
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems };
  },
};
