import { createArchivePagination } from './archive-pagination.js';

// Видеоотзывы открываются в модальном окне, а не на отдельной странице, поэтому проверяется только смена списка.
export const videosPagination = createArchivePagination({
  id: 'videos-pagination',
  title: 'Список видеоотзывов с пагинацией отображается корректно',
  path: '/videos/',
  itemSelector: '#video .cards__item',
  itemsLabel: 'видеоотзывов',
});
