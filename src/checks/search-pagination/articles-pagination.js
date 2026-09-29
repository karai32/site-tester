import { createArchivePagination } from './archive-pagination.js';

export const articlesPagination = createArchivePagination({
  id: 'articles-pagination',
  title: 'Список статей с пагинацией отображается и открывается корректно',
  path: '/article/',
  itemSelector: '.news-item__img',
  itemsLabel: 'статей',
  opensItem: true,
});
