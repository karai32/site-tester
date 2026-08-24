import { chromium } from '@playwright/test';

const selectors = {
  footer: 'footer.footer',
};

const expectedFooter = {
  phoneText: '+7 495 186 42 13',
  phoneHref: 'tel:+74951864213',
  email: 'info@hadassah.moscow',
  emailHref: 'mailto:info@hadassah.moscow',
  details: [
    'НЗА 10180001249',
    'ИНН 9909492395',
    '121205, г. Москва, территория инновационного центра «Сколково», Большой бульвар, дом 46, стр.1.',
  ],
  privacyUrl: 'https://hadassah.moscow/o-hadassah-medical-skolkovo/privacy-policy/',
};

function cleanText(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

export const footerContent = {
  id: 'footer-content',
  title: 'Футер содержит корректные контакты, адрес, реквизиты, ссылки на политику ПДн',

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
      await page.waitForTimeout(1_500);

      const footer = page.locator(selectors.footer);
      if (await footer.count() === 0) {
        return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: 'На главной странице не найден footer.footer.' };
      }

      const problems = [];
      const phone = footer.locator('.footer__phone a').first();
      const email = footer.locator('.footer__mail a').first();
      const details = cleanText(await footer.locator('.footer__details').first().textContent() || '');
      const phoneText = cleanText(await phone.textContent() || '');
      const phoneHref = await phone.getAttribute('href');
      const emailText = cleanText(await email.textContent() || '');
      const emailHref = await email.getAttribute('href');

      if (phoneText !== expectedFooter.phoneText || phoneHref !== expectedFooter.phoneHref) {
        problems.push(`телефон: ${phoneText || 'не найден'} (${phoneHref || 'нет ссылки'})`);
      }

      if (emailText !== expectedFooter.email || emailHref !== expectedFooter.emailHref) {
        problems.push(`email: ${emailText || 'не найден'} (${emailHref || 'нет ссылки'})`);
      }

      for (const detail of expectedFooter.details) {
        if (!details.includes(detail)) {
          problems.push(`в реквизитах отсутствует «${detail}»`);
        }
      }

      const footerLinks = await footer.locator('a[href]').evaluateAll((links) => links.map((link) => ({
        text: (link.textContent || '').replace(/\s+/g, ' ').trim(),
        href: link.href,
      })));
      const privacyLink = footerLinks.find((link) => /политик|персональн|конфиденциальност/i.test(link.text));

      if (privacyLink?.href !== expectedFooter.privacyUrl) {
        problems.push(`ссылка на политику ПДн: ${privacyLink?.href || 'не найдена'}`);
      } else {
        try {
          const response = await context.request.get(privacyLink.href, { failOnStatusCode: false, timeout: 20_000 });
          if (response.status() < 200 || response.status() >= 400) {
            problems.push(`документ политики ПДн вернул HTTP ${response.status()}`);
          }
          await response.dispose();
        } catch {
          problems.push('документ политики ПДн не открывается');
        }
      }

      return problems.length === 0
        ? {
          id: this.id,
          title: this.title, pageUrl: url,
          status: 'passed',
          message: 'Телефон, email, адрес, реквизиты и ссылка на политику ПДн соответствуют заданным значениям.',
        }
        : { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Найдено проблем: ${problems.length}.`, problems };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      return { id: this.id, title: this.title, pageUrl: url, status: 'failed', message: `Проверка не выполнена: ${message}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  },
};
