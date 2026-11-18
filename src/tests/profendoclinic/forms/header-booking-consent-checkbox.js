import { PAGE_TIMEOUT_MS, errorMessage, getStatuses, newPageWithoutCaptcha } from '../helpers.js';

const popupOpenClass = '_active';
const popupOpenDelayMs = 700;

function findForms(pages, getHtml) {
  const formPage = new Map();
  for (const pageUrl of pages) {
    const html = getHtml(pageUrl).replace(/<!--[\s\S]*?-->/g, '');
    for (const match of html.matchAll(/data-wpcf7-id="(\d+)"/g)) {
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

function revealForm(page, formId, openClass) {
  return page.evaluate(([id, className]) => {
    const wrapper = document.querySelector(`.wpcf7[data-wpcf7-id="${id}"]`);
    if (!wrapper) return { found: false };
    const popup = wrapper.closest('.popup');
    if (!popup) return { found: true, popupName: null };

    popup.classList.add(className);
    return { found: true, popupName: [...popup.classList].find((name) => name.startsWith('popup-')) || 'popup' };
  }, [formId, openClass]);
}

function readConsent(page, formId) {
  return page.evaluate((id) => {
    const wrapper = document.querySelector(`.wpcf7[data-wpcf7-id="${id}"]`);
    const checkbox = [...wrapper.querySelectorAll('input[type="checkbox"]')].find((item) => {
      const text = item.closest('label')?.textContent || item.parentElement?.textContent || '';
      return /персональн/i.test(text);
    });
    if (!checkbox) return { found: false };
    const label = checkbox.closest('label') || checkbox.parentElement;
    return {
      found: true,
      checked: checkbox.checked,
      linkUrls: [...label.querySelectorAll('a[href]')].map((link) => link.href),
    };
  }, formId);
}

function screenshotTarget(page, formId, info) {
  const wrapper = page.locator(`.wpcf7[data-wpcf7-id="${formId}"]`).first();
  if (info.popupName) return wrapper.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " popup__body ")]').first();
  return wrapper;
}

export default {
  id: 'header-booking-consent-checkbox',
  title: 'Чекбокс согласия на обработку ПДн присутствует, не отмечен по умолчанию, ссылка на политику рабочая',

  async run({ pages, getHtml, browser }) {
    const formsByPage = findForms(pages, getHtml);
    const linkStatuses = new Map();
    const problems = [];
    const media = [];
    let checkedForms = 0;

    for (const [pageUrl, formIds] of formsByPage) {
      const page = await newPageWithoutCaptcha(browser, { viewport: { width: 1440, height: 900 } });
      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

        for (const formId of formIds) {
          const where = `форма wpcf7-id=${formId} (${pageUrl})`;
          const info = await revealForm(page, formId, popupOpenClass);
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
              problems.push(`${where}: чекбокс согласия отмечен по умолчанию, а пользователь должен подтвердить согласие сам, а не снимать уже стоящую галочку`);
            }
            if (consent.linkUrls.length === 0) {
              problems.push(`${where}: рядом с чекбоксом не найдена ссылка на политику обработки персональных данных`);
            }
            for (const linkUrl of consent.linkUrls) {
              if (!linkStatuses.has(linkUrl)) linkStatuses.set(linkUrl, (await getStatuses([linkUrl])).get(linkUrl));
              const { status, error } = linkStatuses.get(linkUrl);
              if (error) problems.push(`${where}: ссылка рядом с чекбоксом (${linkUrl}): ${error}`);
              else if (status < 200 || status >= 400) problems.push(`${where}: ссылка рядом с чекбоксом (${linkUrl}) вернула HTTP ${status}`);
            }
          }

          const target = screenshotTarget(page, formId, info);
          await target.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(info.popupName ? popupOpenDelayMs : 200);
          try {
            const caption = info.popupName ? `wpcf7-id=${formId}, попап "${info.popupName}"` : `wpcf7-id=${formId}, ${pageUrl}`;
            media.push({ data: await target.screenshot({ type: 'jpeg', quality: 60 }), caption });
          } catch (error) {
            problems.push(`форма wpcf7-id=${formId}: не удалось сделать скриншот (${errorMessage(error)})`);
          }

          if (info.popupName) {
            await page.evaluate(([id, className]) => {
              document.querySelector(`.wpcf7[data-wpcf7-id="${id}"]`)?.closest('.popup')?.classList.remove(className);
            }, [formId, popupOpenClass]);
            await page.waitForTimeout(popupOpenDelayMs);
          }
        }
      } catch (error) {
        problems.push(`страница ${pageUrl}: ${errorMessage(error)}`);
      } finally {
        await page.close().catch(() => {});
      }
    }

    const summary = `Проверено ${checkedForms} уникальных форм (по data-wpcf7-id) на ${formsByPage.size} страниц(ах).`;
    if (problems.length === 0) {
      return {
        passed: true,
        comment: `${summary} Везде чекбокс согласия присутствует, снят по умолчанию, ссылки на документы рабочие.`,
        media,
        pages: [...formsByPage.keys()],
      };
    }
    return {
      passed: false,
      comment: `${summary} Найдено проблем: ${problems.length}.`,
      problems,
      media,
      pages: [...formsByPage.keys()],
    };
  },
};
