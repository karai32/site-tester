import { createArchivePagination } from './archive-pagination.js';

// Карточки отзывов не ведут на отдельные страницы, поэтому проверяется только смена списка.
export const reviewsPagination = createArchivePagination({
  id: 'reviews-pagination',
  title: 'Список отзывов с пагинацией отображается корректно',
  path: '/reviews/',
  itemSelector: '#reviews-grid .video-review-item',
  itemsLabel: 'отзывов',
});
