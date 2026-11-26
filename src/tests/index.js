import hadassah from './hadassah/index.js';
import profendoclinic from './profendoclinic/index.js';

const SITES = {
  'hadassah.moscow': hadassah,
  'profendoclinic.ru': profendoclinic,
};

export function siteCategories(siteUrl) {
  if (!URL.canParse(siteUrl)) return [];
  const host = new URL(siteUrl).hostname.replace(/^www\./, '');
  return SITES[host] || [];
}
