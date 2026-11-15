import { createArchivePagination } from '../helpers/archive-pagination.js';

export default createArchivePagination({
  id: 'gallery-pagination',
  title: 'Галерея с пагинацией отображается и открывается корректно',
  path: '/gallery/',
  itemSelector: '.collections-item__img',
  itemsLabel: 'материалов галереи',
  opensItem: true,
});
