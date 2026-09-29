import { createArchivePagination } from './archive-pagination.js';

export const libraryPagination = createArchivePagination({
  id: 'library-pagination',
  title: 'Библиотека с пагинацией отображается и открывается корректно',
  path: '/library/',
  itemSelector: '.collections-item__img',
  itemsLabel: 'материалов библиотеки',
  opensItem: true,
});
