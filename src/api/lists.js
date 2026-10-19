// Параметры списков в API: страница, фильтры, сортировка.
// Те же, что в адресах страниц сервиса, только категории — через запятую: ?categories=seo,forms
import { paginate, sortFromQuery } from '../lists.js';

const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

// 'seo,forms' → ['seo', 'forms']; пусто — []
export function splitCategories(value) {
  const ids = [];
  for (const part of String(value || '').split(',')) {
    const id = part.trim();
    if (id) ids.push(id);
  }
  return ids;
}

// Общие фильтры списков из адреса запроса
export function listFilters(query) {
  return {
    author: String(query.author || ''),
    categories: splitCategories(query.categories),
    regular: String(query.regular || ''), // 'yes', 'no' или '' — все
    sort: sortFromQuery(query.sort),
  };
}

// Нужная страница списка: { items, meta }. ?page=2&perPage=20
export function pageOf(list, query) {
  let perPage = Number(query.perPage) || DEFAULT_PER_PAGE;
  if (perPage < 1) perPage = DEFAULT_PER_PAGE;
  if (perPage > MAX_PER_PAGE) perPage = MAX_PER_PAGE;

  const pagination = paginate(list, Number(query.page) || 1, perPage);
  return {
    items: pagination.items,
    meta: { page: pagination.page, perPage, total: pagination.total, pagesCount: pagination.pagesCount },
  };
}
