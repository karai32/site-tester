// Картинки на страницах выборки загружаются без ошибок
import { getStatuses } from '../helpers/common.js';

const maxSourcesShown = 5;

function formatSources(sources) {
  const shown = sources.slice(0, maxSourcesShown);
  const rest = sources.length - shown.length;
  return `найдена на: ${shown.join(', ')}${rest > 0 ? ` и ещё ${rest} стр.` : ''}`;
}

// Адреса картинок из <img src> и первого варианта <source srcset>
function extractImageUrls(html, pageUrl) {
  const sources = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    sources.push(match[0].match(/\bsrc=["']([^"']+)["']/i)?.[1]);
  }
  for (const match of html.matchAll(/<source\b[^>]*>/gi)) {
    const srcset = match[0].match(/\bsrcset=["']([^"']+)["']/i)?.[1];
    sources.push(srcset?.split(',')[0].trim().split(/\s+/)[0]);
  }

  const urls = new Set();
  for (const src of sources) {
    if (src && !src.startsWith('data:') && URL.canParse(src, pageUrl)) urls.add(new URL(src, pageUrl).href);
  }
  return [...urls];
}

export default {
  id: 'broken-images-sitewide',
  title: 'Отсутствие «битых» изображений по всем страницам сайта',

  async run({ pages, getHtml }) {
    // Картинка -> страницы, на которых она стоит
    const imagePages = new Map();
    for (const pageUrl of pages) {
      for (const imageUrl of extractImageUrls(getHtml(pageUrl), pageUrl)) {
        if (!imagePages.has(imageUrl)) imagePages.set(imageUrl, []);
        imagePages.get(imageUrl).push(pageUrl);
      }
    }

    const statuses = await getStatuses([...imagePages.keys()]);
    const problems = [];
    for (const [imageUrl, { status, error }] of statuses) {
      if (!error && status >= 200 && status < 400) continue;
      problems.push(`${imageUrl}: ${error || `HTTP ${status}`} (${formatSources(imagePages.get(imageUrl))})`);
    }

    if (problems.length === 0) {
      return {
        passed: true,
        comment: `Проверено ${pages.length} страниц и ${imagePages.size} уникальных изображений, битых не найдено.`,
      };
    }
    return {
      passed: false,
      comment: `Найдено проблем: ${problems.length}. Проверено ${pages.length} страниц и ${imagePages.size} изображений.`,
      problems,
    };
  },
};
