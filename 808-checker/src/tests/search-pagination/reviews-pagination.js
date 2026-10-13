// Отзывы: страница 2 пагинации показывает новые отзывы.
// Карточки отзывов не ведут на отдельные страницы, поэтому проверяется только смена списка.
import { createArchivePagination } from '../helpers/archive-pagination.js';

export default createArchivePagination({
  id: 'reviews-pagination',
  title: 'Список отзывов с пагинацией отображается корректно',
  path: '/reviews/',
  itemSelector: '#reviews-grid .video-review-item',
  itemsLabel: 'отзывов',
});
