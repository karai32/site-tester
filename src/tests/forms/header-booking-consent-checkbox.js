// У каждой формы сайта есть чекбокс согласия на обработку ПДн: он не отмечен заранее,
// рядом рабочая ссылка на политику. Формы ищутся по HTML страниц выборки (data-wpcf7-id).
import { errorMessage, getStatuses } from '../helpers/common.js';

// Страница → id форм, которые проверяем на ней (каждую форму — на первой странице, где она нашлась)
function findForms(pages, getHtml) {
  const formPage = new Map();
  for (const pageUrl of pages) {
    for (const match of getHtml(pageUrl).matchAll(/data-wpcf7-id="(\d+)"/g)) {
      if (!formPage.has(match[1])) formPage.set(match[1], pageUrl);
    }
  }

  const formsByPage = new Map();
  for (const [formId, pageUrl] of formPage) {
    if (!formsByPage.has(pageUrl)) formsByPage.set(pageUrl, []);
    formsByPage.get(pageUrl).push(formId);
  }
  return formsByPage;
}

// Где стоит форма: в модалке (её открываем), в секции страницы или просто на странице
function revealForm(page, formId) {
  return page.evaluate((id) => {
    const wrapper = document.querySelector(`.wpcf7[data-wpcf7-id="${id}"]`);
    if (!wrapper) return { found: false };
    const modal = wrapper.closest('.modal.js-modal');
    if (modal) {
      modal.classList.add('--open');
      return { found: true, kind: 'modal', modalId: modal.id };
    }
    return { found: true, kind: wrapper.closest('.form--page') ? 'section' : 'form' };
  }, formId);
}

// Чекбокс, в подписи которого есть слово «персональн», и ссылка рядом с ним
function readConsent(page, formId) {
  return page.evaluate((id) => {
    const wrapper = document.querySelector(`.wpcf7[data-wpcf7-id="${id}"]`);
    const checkbox = [...wrapper.querySelectorAll('input[type="checkbox"]')].find((cb) => {
      const text = cb.closest('label')?.textContent || cb.parentElement?.textContent || '';
      return /персональн/i.test(text);
    });
    if (!checkbox) return { found: false };
    const link = (checkbox.closest('label') || checkbox.parentElement)?.querySelector('a[href]');
    return { found: true, checked: checkbox.checked, linkHref: link ? link.getAttribute('href') : null };
  }, formId);
}

// Что снимать на скриншот для формы
async function screenshotTarget(page, formId, info) {
  if (info.kind === 'modal') {
    const modal = page.locator(`#${info.modalId}`);
    const body = modal.locator('.modal__body').first();
    return (await body.count()) > 0 ? body : modal;
  }
  if (info.kind === 'section') {
    return page.locator(`.wpcf7[data-wpcf7-id="${formId}"]`)
      .locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " form--page ")]')
      .first();
  }
  return page.locator(`.wpcf7[data-wpcf7-id="${formId}"]`).first();
}

export default {
  id: 'header-booking-consent-checkbox',
  title: 'Чекбокс согласия на обработку ПДн присутствует, не отмечен по умолчанию, ссылка на политику рабочая',

  async run({ pages, getHtml, browser }) {
    const formsByPage = findForms(pages, getHtml);
    const problems = [];
    const media = [];
    let checkedForms = 0;

    for (const [pageUrl, formIds] of formsByPage) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

        for (const formId of formIds) {
          const where = `форма wpcf7-id=${formId} (${pageUrl})`;
          const info = await revealForm(page, formId);
          if (!info.found) {
            problems.push(`${where}: не найдена при повторном открытии страницы`);
            continue;
          }
          checkedForms += 1;

          const consent = await readConsent(page, formId);
          if (!consent.found) {
            problems.push(`${where}: не найден чекбокс согласия на обработку персональных данных`);
          } else {
            if (consent.checked) {
              problems.push(`${where}: чекбокс согласия отмечен по умолчанию (checked="checked") — пользователь должен подтвердить согласие сам, а не снимать уже стоящую галочку`);
            }
            if (!consent.linkHref) {
              problems.push(`${where}: рядом с чекбоксом не найдена ссылка на политику обработки персональных данных`);
            } else {
              const linkUrl = new URL(consent.linkHref, pageUrl).href;
              const { status, error } = (await getStatuses([linkUrl])).get(linkUrl);
              if (error) problems.push(`${where}: ссылка на политику ПДн (${linkUrl}) — ${error}`);
              else if (status < 200 || status >= 400) problems.push(`${where}: ссылка на политику ПДн (${linkUrl}) вернула HTTP ${status}`);
            }
          }

          const target = await screenshotTarget(page, formId, info);
          await target.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(200);
          try {
            const caption = info.kind === 'modal' ? `wpcf7-id=${formId}, модалка "${info.modalId}"` : `wpcf7-id=${formId}, ${pageUrl}`;
            media.push({ data: await target.screenshot({ type: 'jpeg', quality: 60 }), caption });
          } catch (error) {
            problems.push(`форма wpcf7-id=${formId}: не удалось сделать скриншот (${errorMessage(error)})`);
          }

          if (info.kind === 'modal') {
            await page.evaluate((modalId) => document.getElementById(modalId)?.classList.remove('--open'), info.modalId);
          }
        }
      } catch (error) {
        problems.push(`страница ${pageUrl}: ${errorMessage(error)}`);
      } finally {
        await page.close().catch(() => {});
      }
    }

    const summary = `Проверено ${checkedForms} уникальных форм (по data-wpcf7-id) на ${formsByPage.size} страниц(ах).`;
    return problems.length === 0
      ? { passed: true, comment: `${summary} Везде чекбокс согласия присутствует, снят по умолчанию, ссылка на политику ПДн рабочая.`, media, pages: [...formsByPage.keys()] }
      : { passed: false, comment: `${summary} Найдено проблем: ${problems.length}.`, problems, media, pages: [...formsByPage.keys()] };
  },
};
