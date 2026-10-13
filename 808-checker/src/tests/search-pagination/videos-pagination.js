// Видеоотзывы: страница 2 пагинации показывает новые видео.
// Видеоотзывы открываются в модальном окне, а не на отдельной странице, поэтому проверяется только смена списка.
import { createArchivePagination } from '../helpers/archive-pagination.js';

export default createArchivePagination({
  id: 'videos-pagination',
  title: 'Список видеоотзывов с пагинацией отображается корректно',
  path: '/videos/',
  itemSelector: '#video .cards__item',
  itemsLabel: 'видеоотзывов',
});
