// На внутренних страницах выборки есть микроразметка хлебных крошек BreadcrumbList (JSON-LD)
function hasBreadcrumbSchema(html) {
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    if (/"@type"\s*:\s*"BreadcrumbList"/.test(match[1])) return true;
  }
  return false;
}

export default {
  id: 'breadcrumb-schema',
  title: 'Микроразметка BreadcrumbList присутствует на внутренних страницах сайта',

  async run({ siteUrl, pages, getHtml }) {
    // У главной хлебных крошек нет
    const home = new URL('/', siteUrl).href;
    const innerPages = pages.filter((pageUrl) => pageUrl !== home);

    const problems = [];
    for (const pageUrl of innerPages) {
      if (!hasBreadcrumbSchema(getHtml(pageUrl))) problems.push(`${pageUrl}: микроразметка BreadcrumbList не найдена`);
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${innerPages.length} HTML-страниц сайта (без учёта главной), BreadcrumbList есть везде.`,
      };
    }
    return {
      passed: false,
      comment: `Найдено проблем: ${problems.length}. Проверено ${innerPages.length} страниц.`,
      problems,
    };
  },
};
