import { createArchivePagination } from '../helpers/archive-pagination.js';

export default createArchivePagination({
  id: 'videos-pagination',
  title: 'Список видеоотзывов с пагинацией отображается корректно',
  path: '/videos/',
  itemSelector: '#video .cards__item',
  itemsLabel: 'видеоотзывов',
});
