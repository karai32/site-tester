import { createArchivePagination } from '../helpers.js';

export default createArchivePagination({
  id: 'articles-pagination',
  title: 'Список статей с пагинацией отображается и открывается корректно',
  path: '/article/',
  itemSelector: '.news-item__img',
  itemsLabel: 'статей',
  opensItem: true,
});
