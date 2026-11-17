import { createArchivePagination } from '../helpers.js';

export default createArchivePagination({
  id: 'reviews-pagination',
  title: 'Список отзывов с пагинацией отображается корректно',
  path: '/reviews/',
  itemSelector: '#reviews-grid .video-review-item',
  itemsLabel: 'отзывов',
});
