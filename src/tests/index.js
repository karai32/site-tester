import hadassah from './hadassah/index.js';

const SITES = {
  'hadassah.moscow': hadassah,
};

export function siteCategories(siteUrl) {
  if (!URL.canParse(siteUrl)) return [];
  const host = new URL(siteUrl).hostname.replace(/^www\./, '');
  return SITES[host] || [];
}

export function allCategories() {
  const all = [];
  for (const categories of Object.values(SITES)) {
    for (const category of categories) {
      let merged = all.find((item) => item.id === category.id);
      if (!merged) {
        merged = { ...category, tests: [] };
        all.push(merged);
      }
      for (const test of category.tests) {
        if (!merged.tests.some((item) => item.id === test.id)) merged.tests.push(test);
      }
    }
  }
  return all;
}
