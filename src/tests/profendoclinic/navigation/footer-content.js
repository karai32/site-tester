import { PAGE_TIMEOUT_MS, getStatuses } from '../helpers.js';

const selectors = {
  footer: 'footer.footer',
  phone: 'a.footer__info-link[href^="tel:"]',
  address: '.footer__info-address',
  details: '.footer__note',
  legalLinks: '.legal-notice a[href]',
};

const expectedFooter = {
  phoneText: '+7 495 230 58 10',
  phoneHref: 'tel:+74952305810',
  address: 'г. Москва, ул. Андреевская набережная, дом 1, корпус 1',
  details: [
    'ООО «Профессорская клиника эндокринологии и диабета»',
    'ИНН 7736361030',
  ],
  privacyUrl: 'https://profendoclinic.ru/politics/',
};

function cleanText(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

export default {
  id: 'footer-content',
  title: 'Футер содержит корректные контакты, адрес, реквизиты, ссылки на политику ПДн',

  async run({ siteUrl, browser }) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

    const footer = page.locator(selectors.footer);
    if (await footer.count() === 0) {
      return { passed: false, comment: `На главной странице не найден ${selectors.footer}.` };
    }

    const footerData = await footer.first().evaluate((element, sel) => {
      const phone = element.querySelector(sel.phone);
      return {
        phoneText: phone ? phone.textContent : '',
        phoneHref: phone ? phone.getAttribute('href') : '',
        address: element.querySelector(sel.address)?.textContent || '',
        details: element.querySelector(sel.details)?.textContent || '',
        legalLinks: [...element.querySelectorAll(sel.legalLinks)].map((link) => ({ text: link.textContent, href: link.href })),
      };
    }, selectors);

    const problems = [];
    const phoneText = cleanText(footerData.phoneText);
    if (phoneText !== expectedFooter.phoneText || footerData.phoneHref !== expectedFooter.phoneHref) {
      problems.push(`телефон: ${phoneText || 'не найден'} (${footerData.phoneHref || 'нет ссылки'})`);
    }
    if (!cleanText(footerData.address).includes(expectedFooter.address)) {
      problems.push(`в адресе отсутствует «${expectedFooter.address}»`);
    }
    const details = cleanText(footerData.details);
    for (const detail of expectedFooter.details) {
      if (!details.includes(detail)) problems.push(`в реквизитах отсутствует «${detail}»`);
    }

    const privacyLink = footerData.legalLinks.find((link) => /политик|персональн|конфиденциальност/i.test(link.text));
    if (privacyLink?.href !== expectedFooter.privacyUrl) {
      problems.push(`ссылка на политику ПДн: ${privacyLink?.href || 'не найдена'}`);
    } else {
      const { status, error } = (await getStatuses([privacyLink.href])).get(privacyLink.href);
      if (error) problems.push('документ политики ПДн не открывается');
      else if (status < 200 || status >= 400) problems.push(`документ политики ПДн вернул HTTP ${status}`);
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: 'Телефон, адрес, реквизиты и ссылка на политику ПДн соответствуют заданным значениям.',
      };
    }
    return { passed: false, comment: `Найдено проблем: ${problems.length}.`, problems };
  },
};
