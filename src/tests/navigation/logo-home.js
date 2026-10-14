// Логотип в шапке ведёт на главную на всех страницах выборки
function findLogoHref(html) {
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    const classes = (tag.match(/\bclass=["']([^"']*)["']/i)?.[1] || '').split(/\s+/);
    if (classes.includes('logo') && classes.includes('header__logo')) {
      return tag.match(/\bhref=["']([^"']*)["']/i)?.[1] || null;
    }
  }
  return null;
}

export default {
  id: 'logo-home',
  title: 'Логотип в шапке ведёт на главную страницу с любой страницы сайта',

  async run({ siteUrl, pages, getHtml }) {
    const home = new URL('/', siteUrl).href;
    const problems = [];

    for (const pageUrl of pages) {
      const logoHref = findLogoHref(getHtml(pageUrl));
      if (!logoHref || new URL(logoHref, pageUrl).href !== home) {
        problems.push(`${pageUrl}: логотип ведёт на ${logoHref || 'неизвестный адрес'}`);
      }
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Логотип ведёт на главную на всех ${pages.length} проверенных страницах.`,
      };
    }
    return {
      passed: false,
      comment: `Найдено проблем: ${problems.length}. Проверено ${pages.length} страниц.`,
      problems,
    };
  },
};
