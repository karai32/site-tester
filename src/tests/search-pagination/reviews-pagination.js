import { createArchivePagination } from '../helpers/archive-pagination.js';

export default createArchivePagination({
  id: 'reviews-pagination',
  title: 'Список отзывов с пагинацией отображается корректно',
  path: '/reviews/',
  itemSelector: '#reviews-grid .video-review-item',
  itemsLabel: 'отзывов',
});
