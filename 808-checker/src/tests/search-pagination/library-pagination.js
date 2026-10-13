// Библиотека: страница 2 пагинации показывает новые материалы, материал открывается
import { createArchivePagination } from '../helpers/archive-pagination.js';

export default createArchivePagination({
  id: 'library-pagination',
  title: 'Библиотека с пагинацией отображается и открывается корректно',
  path: '/library/',
  itemSelector: '.collections-item__img',
  itemsLabel: 'материалов библиотеки',
  opensItem: true,
});
