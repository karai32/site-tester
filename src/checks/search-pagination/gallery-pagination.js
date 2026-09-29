import { createArchivePagination } from './archive-pagination.js';

export const galleryPagination = createArchivePagination({
  id: 'gallery-pagination',
  title: 'Галерея с пагинацией отображается и открывается корректно',
  path: '/gallery/',
  itemSelector: '.collections-item__img',
  itemsLabel: 'материалов галереи',
  opensItem: true,
});
