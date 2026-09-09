import { chromium } from '@playwright/test';
import { fetchPagesContent } from '../../site-crawler.js';

export const headerBookingConsentCheckbox = {
  id: 'header-booking-consent-checkbox',
  title: 'Чекбокс согласия на обработку ПДн присутствует, не отмечен по умолчанию, ссылка на политику рабочая',

  async run({ url, pages, pagesError }) {
    if (pagesError) {
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: не удалось получить список страниц сайта (${pagesError})` };
    }

    let browser;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

      const formPages = new Map();
      for await (const [pageUrl, { html }] of fetchPagesContent(context.request, pages)) {
        if (!html) continue;
        for (const match of html.matchAll(/data-wpcf7-id="(\d+)"/g)) {
          const formId = match[1];
          if (!formPages.has(formId)) formPages.set(formId, pageUrl);
        }
      }

      const pagesToVisit = new Map();
      for (const [formId, pageUrl] of formPages) {
        if (!pagesToVisit.has(pageUrl)) pagesToVisit.set(pageUrl, []);
        pagesToVisit.get(pageUrl).push(formId);
      }

      const screenshots = [];
      const problems = [];
      let checkedForms = 0;

      for (const [pageUrl, formIds] of pagesToVisit) {
        const page = await context.newPage();
        try {
          await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

          for (const formId of formIds) {
            const info = await page.evaluate((id) => {
              const wrapper = document.querySelector(`.wpcf7[data-wpcf7-id="${id}"]`);
              if (!wrapper) return { found: false };
              const modal = wrapper.closest('.modal.js-modal');
              if (modal) {
                modal.classList.add('--open');
                return { found: true, kind: 'modal', modalId: modal.id };
              }
              const section = wrapper.closest('.form--page');
              return { found: true, kind: section ? 'section' : 'form' };
            }, formId);

            if (!info.found) {
              problems.push(`форма wpcf7-id=${formId}: не найдена на странице ${pageUrl} при повторном открытии`);
              continue;
            }

            checkedForms += 1;

            const consent = await page.evaluate((id) => {
              const wrapper = document.querySelector(`.wpcf7[data-wpcf7-id="${id}"]`);
              const checkboxes = [...wrapper.querySelectorAll('input[type="checkbox"]')];
              const match = checkboxes.find((cb) => {
                const text = cb.closest('label')?.textContent || cb.parentElement?.textContent || '';
                return /персональн/i.test(text);
              });
              if (!match) return { found: false };
              const container = match.closest('label') || match.parentElement;
              const link = container?.querySelector('a[href]');
              return { found: true, checked: match.checked, linkHref: link ? link.getAttribute('href') : null };
            }, formId);

            let target;
            let label;

            if (info.kind === 'modal') {
              const modalLocator = page.locator(`#${info.modalId}`);
              const body = modalLocator.locator('.modal__body').first();
              target = (await body.count()) > 0 ? body : modalLocator;
              label = `wpcf7-id=${formId}, модалка "${info.modalId}"`;
            } else if (info.kind === 'section') {
              target = page
                .locator(`.wpcf7[data-wpcf7-id="${formId}"]`)
                .locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " form--page ")]')
                .first();
              label = `wpcf7-id=${formId}, секция на странице ${pageUrl}`;
            } else {
              target = page.locator(`.wpcf7[data-wpcf7-id="${formId}"]`).first();
              label = `wpcf7-id=${formId}, ${pageUrl}`;
            }

            await target.scrollIntoViewIfNeeded().catch(() => {});
            await page.waitForTimeout(200);

            if (!consent.found) {
              problems.push(`форма wpcf7-id=${formId} (${pageUrl}): не найден чекбокс согласия на обработку персональных данных`);
            } else {
              if (consent.checked) {
                problems.push(`форма wpcf7-id=${formId} (${pageUrl}): чекбокс согласия отмечен по умолчанию (checked="checked") — пользователь должен подтвердить согласие сам, а не снимать уже стоящую галочку`);
              }

              if (!consent.linkHref) {
                problems.push(`форма wpcf7-id=${formId} (${pageUrl}): рядом с чекбоксом не найдена ссылка на политику обработки персональных данных`);
              } else {
                const linkTarget = new URL(consent.linkHref, pageUrl).href;
                try {
                  const response = await context.request.get(linkTarget, { failOnStatusCode: false, timeout: 20_000 });
                  const status = response.status();
                  await response.dispose();
                  if (status < 200 || status >= 400) {
                    problems.push(`форма wpcf7-id=${formId} (${pageUrl}): ссылка на политику ПДн (${linkTarget}) вернула HTTP ${status}`);
                  }
                } catch (error) {
                  const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
                  problems.push(`форма wpcf7-id=${formId} (${pageUrl}): ссылка на политику ПДн (${linkTarget}) — ${message}`);
                }
              }
            }

            try {
              const buffer = await target.screenshot({ type: 'jpeg', quality: 60 });
              screenshots.push({ label, image: `data:image/jpeg;base64,${buffer.toString('base64')}` });
            } catch (error) {
              const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
              problems.push(`форма wpcf7-id=${formId}: не удалось сделать скриншот (${message})`);
            }

            if (info.kind === 'modal') {
              await page.evaluate((modalId) => document.getElementById(modalId)?.classList.remove('--open'), info.modalId);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
          problems.push(`страница ${pageUrl}: ${message}`);
        } finally {
          await page.close().catch(() => {});
        }
      }

      const summary = `Проверено ${checkedForms} уникальных форм (по data-wpcf7-id) на ${pagesToVisit.size} страниц(ах).`;

      return problems.length === 0
        ? { id: this.id, title: this.title, pageUrl: url, status: 'passed', message: `${summary} Везде чекбокс согласия присутствует, снят по умолчанию, ссылка на политику ПДн рабочая.`, screenshots }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `${summary} Найдено проблем: ${problems.length}.`, problems, screenshots };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
