// Список статей: страница 2 пагинации показывает новые статьи, статья открывается
import { createArchivePagination } from '../helpers/archive-pagination.js';

export default createArchivePagination({
  id: 'articles-pagination',
  title: 'Список статей с пагинацией отображается и открывается корректно',
  path: '/article/',
  itemSelector: '.news-item__img',
  itemsLabel: 'статей',
  opensItem: true,
});
