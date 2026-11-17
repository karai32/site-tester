import {
  cancelDeferredCheck,
  createScenario,
  nextRevision,
  setDeferredCheck,
  setNextRunAt,
  setScenarioActive,
} from './db/scenarios.js';
import { toList } from './lists.js';
import { cleanNotifications } from './notifications/settings.js';
import { PAGE_SETS } from './runner/page-sets.js';
import { cleanSchedule, firstRunText, scenarioSchedule, toUtcText } from './schedule.js';
import { allTests } from './scenario-info.js';

export function cleanScenario(input) {
  const scheduleResult = cleanSchedule(input.schedule);
  const notificationsResult = cleanNotifications(input.notifications);

  const testIds = toList(input.testIds).filter((id) => allTests.some((test) => test.id === id));
  const pageSets = toList(input.pageSets).filter((id) => PAGE_SETS.some((set) => set.id === id));

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

export function saveScenario({ projectId, authorId, scenario, source }) {
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

export function revisionName(source) {
  const baseName = source.name.replace(/\s*#\d+$/, '');
  return `${baseName} #${nextRevision(source.root_id || source.id)}`;
}

export function setActive(scenario, isActive) {
  setScenarioActive(scenario.id, isActive);

  if (isActive) {
    setNextRunAt(scenario.id, firstRunText(scenarioSchedule(scenario)));
  } else {
    cancelDeferredCheck(scenario.id);
  }
}

export function planDeferredCheck(scenario, runAt, userId) {
  if (!runAt) return 'Укажите дату и время проверки';
  if (runAt <= new Date()) return 'Это время уже прошло';

  setDeferredCheck(scenario.id, toUtcText(runAt), userId);
  return null;
}
