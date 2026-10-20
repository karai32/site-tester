// Справочники и владелец ключа. Справочники нужны админке, чтобы собрать формы:
// какие есть тесты, выборки страниц, варианты расписания и события уведомлений.
import { CHANNELS, NOTIFICATION_EVENTS } from '../notifications/settings.js';
import { PAGE_SETS } from '../runner/page-sets.js';
import { SCHEDULE_TYPES } from '../schedule.js';
import { categories } from '../tests/index.js';
import { formatUser } from './format.js';
import { sendData } from './response.js';

export default async function catalogApi(app) {
  // Чей ключ: от имени этого пользователя идут все запросы
  app.get('/me', async (request, reply) => {
    return sendData(reply, formatUser(request.apiUser));
  });

  app.get('/catalog', async (_request, reply) => {
    const categoryList = [];
    for (const category of categories) {
      const tests = [];
      for (const test of category.tests) {
        tests.push({ id: test.id, title: test.title });
      }
      categoryList.push({ id: category.id, title: category.title, shortTitle: category.shortTitle, tests });
    }

    const scheduleTypes = [];
    for (const type of SCHEDULE_TYPES) {
      scheduleTypes.push({
        id: type.id,
        title: type.title,
        hint: type.hint || null,
        hasTime: type.hasTime,
        number: type.number || null, // { unit, min, max, default } - у вариантов с числом
      });
    }

    return sendData(reply, {
      categories: categoryList,
      pageSets: PAGE_SETS.map((set) => ({ id: set.id, title: set.title })),
      scheduleTypes,
      notificationEvents: NOTIFICATION_EVENTS,
      notificationChannels: CHANNELS,
    });
  });
}
