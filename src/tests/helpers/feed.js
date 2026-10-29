// Проверка фида для тестов категории «SEO-инфраструктура»:
// фид открывается, отдаётся как XML нужного вида и в нём есть записи.

// Сколько раз в тексте встречается тег: <doctor id="1"> и <doctor> считаются, <doctors> нет
function countTags(text, tag) {
  const matches = text.match(new RegExp(`<${tag}[\\s>]`, 'g'));
  if (!matches) return 0;
  return matches.length;
}

// feed: { path, rootTag, itemTag, itemsTitle }
//   path - адрес фида на сайте: '/yml/doctors.php'
//   rootTag - главный тег фида: 'shop' или 'yml_catalog'
//   itemTag - тег одной записи: 'doctor' или 'offer'
//   itemsTitle - как назвать записи в комментарии: 'врачей'
export async function checkFeed({ siteUrl, browser }, feed) {
  const url = new URL(feed.path, siteUrl).href;
  const page = await browser.newPage();

  const response = await page.request.get(url, { failOnStatusCode: false, timeout: 60_000 });
  const status = response.status();
  const contentType = response.headers()['content-type'] || '';
  let text = '';
  if (status === 200) text = await response.text();
  await response.dispose();

  let problem = null;
  if (status !== 200) {
    problem = `Фид недоступен: HTTP ${status}`;
  } else if (!contentType.includes('xml')) {
    problem = `Фид отдаётся не как XML (content-type: ${contentType})`;
  } else if (countTags(text, feed.rootTag) === 0) {
    problem = `В фиде нет главного тега <${feed.rootTag}>`;
  } else if (countTags(text, feed.itemTag) === 0) {
    problem = `В фиде нет ни одной записи <${feed.itemTag}>`;
  }

  if (problem) {
    return {
      passed: false,
      comment: problem,
      problems: [problem],
      pages: [url],
    };
  }

  return {
    passed: true,
    comment: `Фид открывается, ${feed.itemsTitle}: ${countTags(text, feed.itemTag)}.`,
    pages: [url],
  };
}
