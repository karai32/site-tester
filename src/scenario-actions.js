// Действия со сценариями - общие для страниц сервиса (routes/scenarios.js) и API (api/scenarios.js):
// проверка данных, создание и новая редакция, включение и выключение, отложенная проверка.
import {
  cancelDeferredCheck,
  createScenario,
  nextRevision,
  setDeferredCheck,
  setNextRunAt,
  setScenarioActive,
} from './db/scenarios.js';
import { cleanNotifications } from './notifications/settings.js';
import { PAGE_SETS } from './runner/page-sets.js';
import { cleanSchedule, firstRunText, scenarioSchedule, toUtcText } from './schedule.js';
import { allTests } from './scenario-info.js';

// Список из запроса: не массив - пустой список
function toArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

// Проверка данных сценария.
// input: { name, testIds, pageSets, schedule, notifications } - schedule и notifications см. в
// cleanSchedule (schedule.js) и cleanNotifications (notifications/settings.js).
// Возвращает { scenario, errors }: errors - ошибки по полям { name: 'текст' }, пусто - всё верно.
export function cleanScenario(input) {
  const scheduleResult = cleanSchedule(input.schedule);
  const notificationsResult = cleanNotifications(input.notifications);

  // Берём только существующие тесты и выборки: прислать могут что угодно
  const testIds = toArray(input.testIds).filter((id) => allTests.some((test) => test.id === id));
  const pageSets = toArray(input.pageSets).filter((id) => PAGE_SETS.some((set) => set.id === id));

  const scenario = {
    name: String(input.name || '').trim(),
    testIds,
    pageSets,
    schedule: scheduleResult.schedule,
    notifications: notificationsResult.notifications,
  };

  const errors = {};
  if (!scenario.name) errors.name = 'Укажите название сценария';
  if (testIds.length === 0) errors.testIds = 'Выберите хотя бы один тест';
  if (pageSets.length === 0) errors.pageSets = 'Выберите хотя бы одну выборку страниц';
  Object.assign(errors, scheduleResult.errors, notificationsResult.errors);

  return { scenario, errors };
}

// Сохраняет проверенный сценарий (из cleanScenario). Возвращает id нового сценария.
// source - исходный сценарий, если это новая редакция («Скопировать и изменить»): исходный не меняется.
export function saveScenario({ projectId, authorId, scenario, source }) {
  // Все редакции ссылаются на самый первый сценарий - по нему считается номер следующей
  let rootId = null;
  let revision = 1;
  if (source) {
    rootId = source.root_id || source.id;
    revision = nextRevision(rootId);
  }

  return createScenario({
    projectId,
    authorId,
    name: scenario.name,
    testIds: scenario.testIds,
    pageSets: scenario.pageSets,
    rootId,
    revision,
    schedule: scenario.schedule,
    nextRunAt: firstRunText(scenario.schedule),
    notifications: scenario.notifications,
  });
}

// Название новой редакции: «Полный аудит #2» -> «Полный аудит #3» (старый номер убираем, ставим следующий)
export function revisionName(source) {
  const baseName = source.name.replace(/\s*#\d+$/, '');
  return `${baseName} #${nextRevision(source.root_id || source.id)}`;
}

// Включить или выключить сценарий
export function setActive(scenario, isActive) {
  setScenarioActive(scenario.id, isActive);

  if (isActive) {
    // Пока сценарий был выключен, запуски по расписанию не шли - считаем следующий заново
    setNextRunAt(scenario.id, firstRunText(scenarioSchedule(scenario)));
  } else {
    // Выключенный сценарий не запускается, поэтому отложенная проверка отменяется
    cancelDeferredCheck(scenario.id);
  }
}

// Отложенная проверка в момент runAt (Date или null, если дата неверная).
// Возвращает текст ошибки или null, если проверка запланирована.
export function planDeferredCheck(scenario, runAt, userId) {
  if (!runAt) return 'Укажите дату и время проверки';
  if (runAt <= new Date()) return 'Это время уже прошло';

  setDeferredCheck(scenario.id, toUtcText(runAt), userId);
  return null;
}
