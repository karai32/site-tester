// Уведомления о проверке: по настройкам сценария решает, что, каким способом и кому отправить.
// Ошибки отправки только пишутся в лог — на проверку они не влияют.
import { APP_URL } from '../config.js';
import { findProjectById } from '../db/projects.js';
import { findPreviousDoneReport, findReportById, getReportResults } from '../db/reports.js';
import { findScenarioById } from '../db/scenarios.js';
import { percentOf } from '../helpers.js';
import { isEmailConfigured, sendEmail } from './email.js';
import { isTelegramConfigured, sendTelegram } from './telegram.js';

const MAX_LIST = 10; // сколько тестов перечислять в сообщении, об остальных — «…и ещё N»

// Тесты строками «— название»
function testList(results) {
  const lines = [];
  for (const result of results.slice(0, MAX_LIST)) {
    lines.push(`— ${result.test_title}`);
  }
  if (results.length > MAX_LIST) lines.push(`…и ещё ${results.length - MAX_LIST}`);
  return lines.join('\n');
}

// Отправляет сообщение тем способом, который выбран в сценарии для события eventId
async function deliver(notifications, eventId, subject, text, log) {
  const channel = notifications.events[eventId];

  if (channel === 'telegram') {
    if (!isTelegramConfigured()) {
      log.warn(`Уведомление «${subject}» не отправлено: Telegram-бот не настроен`);
      return;
    }
    for (const chatId of notifications.telegramIds) {
      try {
        await sendTelegram(chatId, `${subject}\n\n${text}`);
      } catch (error) {
        log.error(`Уведомление в Telegram ${chatId} не отправлено: ${error.message}`);
      }
    }
  }

  if (channel === 'email') {
    if (!isEmailConfigured()) {
      log.warn(`Уведомление «${subject}» не отправлено: почта не настроена`);
      return;
    }
    for (const email of notifications.emails) {
      try {
        await sendEmail(email, subject, text);
      } catch (error) {
        log.error(`Письмо на ${email} не отправлено: ${error.message}`);
      }
    }
  }
}

// Проверка началась
export async function notifyCheckStarted(reportId, log) {
  try {
    const report = findReportById(reportId);
    const scenario = findScenarioById(report.scenario_id);
    const project = findProjectById(report.project_id);

    const subject = `${project.name}: началась проверка «${scenario.name}»`;
    const text = `Отчёт будет здесь: ${APP_URL}/reports/${report.id}`;
    await deliver(scenario.notifications, 'started', subject, text, log);
  } catch (error) {
    log.error(`Уведомления о запуске отчёта #${reportId}: ${error.message}`);
  }
}

// Проверка закончилась: итог, критические ошибки, повторяющиеся ошибки, смена статусов тестов
export async function notifyCheckFinished(reportId, log) {
  try {
    const report = findReportById(reportId);
    const scenario = findScenarioById(report.scenario_id);
    const project = findProjectById(report.project_id);
    const settings = scenario.notifications;
    const link = `Отчёт: ${APP_URL}/reports/${report.id}`;
    const title = `${project.name}, «${scenario.name}»`;

    // Проверка не выполнилась — это критическая ошибка
    if (report.status === 'error') {
      await deliver(settings, 'critical', `${title}: проверка не выполнилась`, `${report.error}\n\n${link}`, log);
      return;
    }
    if (report.status !== 'done') return; // отменённая проверка — без уведомлений

    const results = getReportResults(report.id);
    const failed = results.filter((result) => !result.passed);
    const percent = percentOf(report.tests_passed, report.tests_total);
    const isPassed = percent >= settings.passPercent;

    // Итог. Для проверок по расписанию — отдельная настройка «после регулярных проверок».
    let summaryEvent = 'done';
    if (report.is_regular) summaryEvent = 'regular';
    let verdict = 'пройдена';
    if (!isPassed) verdict = 'не пройдена';
    await deliver(
      settings,
      summaryEvent,
      `${title}: проверка ${verdict}`,
      `Успешных тестов: ${report.tests_passed}/${report.tests_total} (${percent}%, порог ${settings.passPercent}%)\n\n${link}`,
      log,
    );

    // Успешность ниже порога — критические ошибки: какие тесты провалены
    if (!isPassed) {
      await deliver(
        settings,
        'critical',
        `${title}: успешность ${percent}% — ниже порога ${settings.passPercent}%`,
        `Провалены тесты:\n${testList(failed)}\n\n${link}`,
        log,
      );
    }

    // Дальше сравниваем с прошлым отчётом этого сценария
    const previous = findPreviousDoneReport(scenario.id, report.id);
    if (!previous) return;

    // Статус каждого теста в прошлом отчёте: { 'title-present': 1, ... }
    const previousPassed = {};
    for (const result of getReportResults(previous.id)) {
      previousPassed[result.test_id] = result.passed;
    }

    // Повторяющиеся ошибки: тест провален и сейчас, и в прошлый раз
    const repeated = failed.filter((result) => previousPassed[result.test_id] === 0);
    if (repeated.length > 0) {
      await deliver(settings, 'repeated', `${title}: тесты провалены второй раз подряд`, `${testList(repeated)}\n\n${link}`, log);
    }

    // Смена статуса: был успешен — стал провален, и наоборот
    const broken = results.filter((result) => !result.passed && previousPassed[result.test_id] === 1);
    const fixed = results.filter((result) => result.passed && previousPassed[result.test_id] === 0);
    if (broken.length > 0 || fixed.length > 0) {
      const parts = [];
      if (broken.length > 0) parts.push(`Стали проваленными:\n${testList(broken)}`);
      if (fixed.length > 0) parts.push(`Стали успешными:\n${testList(fixed)}`);
      parts.push(link);
      await deliver(settings, 'status', `${title}: изменился статус тестов`, parts.join('\n\n'), log);
    }
  } catch (error) {
    log.error(`Уведомления по отчёту #${reportId}: ${error.message}`);
  }
}
