// На каждой странице выборки ровно один <link rel="canonical"> с полным адресом (https://...)
function getCanonicalHrefs(html) {
  const hrefs = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/rel=["']canonical["']/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) hrefs.push(href.trim());
  }
  return hrefs;
}

function isAbsoluteHttpUrl(value) {
  return URL.canParse(value) && /^https?:$/.test(new URL(value).protocol);
}

export default {
  id: 'canonical-urls',
  title: 'Canonical URL указан ровно один раз и является корректной абсолютной ссылкой на всех страницах сайта',

  async run({ pages, getHtml }) {
    const problems = [];
    for (const pageUrl of pages) {
      const hrefs = getCanonicalHrefs(getHtml(pageUrl));
      if (hrefs.length === 0) {
        problems.push(`${pageUrl}: тег canonical отсутствует`);
      } else if (hrefs.length > 1) {
        problems.push(`${pageUrl}: найдено ${hrefs.length} тегов canonical (${hrefs.join(', ')})`);
      } else if (!isAbsoluteHttpUrl(hrefs[0])) {
        problems.push(`${pageUrl}: canonical "${hrefs[0]}" не является корректной абсолютной ссылкой`);
      }
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${pages.length} HTML-страниц сайта, у всех ровно один корректный canonical.`,
      };
    }
    return {
      passed: false,
      comment: `Найдено проблем: ${problems.length}. Проверено ${pages.length} страниц.`,
      problems,
    };
  },
};
