import { APP_URL } from '../config.js';
import { findProjectById } from '../db/projects.js';
import { findPreviousDoneReport, findReportById, getReportResults } from '../db/reports.js';
import { findScenarioById } from '../db/scenarios.js';
import { percentOf } from '../helpers.js';
import { isEmailConfigured, sendEmail } from './email.js';
import { isTelegramConfigured, sendTelegram } from './telegram.js';

const MAX_LIST = 10;

function testList(results) {
  const lines = [];
  for (const result of results.slice(0, MAX_LIST)) {
    lines.push(`- ${result.test_title}`);
  }
  if (results.length > MAX_LIST) lines.push(`...и ещё ${results.length - MAX_LIST}`);
  return lines.join('\n');
}

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

export async function notifyCheckFinished(reportId, log) {
  try {
    const report = findReportById(reportId);
    const scenario = findScenarioById(report.scenario_id);
    const project = findProjectById(report.project_id);
    const settings = scenario.notifications;
    const link = `Отчёт: ${APP_URL}/reports/${report.id}`;
    const title = `${project.name}, «${scenario.name}»`;

    if (report.status === 'error') {
      await deliver(settings, 'critical', `${title}: проверка не выполнилась`, `${report.error}\n\n${link}`, log);
      return;
    }
    if (report.status !== 'done') return;

    const results = getReportResults(report.id);
    const failed = results.filter((result) => !result.passed);
    const percent = percentOf(report.tests_passed, report.tests_total);
    const isPassed = percent >= settings.passPercent;

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

    const previous = findPreviousDoneReport(scenario.id, report.id);
    if (!previous) return;

    const previousPassed = {};
    for (const result of getReportResults(previous.id)) {
      previousPassed[result.test_id] = result.passed;
    }

    const repeated = failed.filter((result) => previousPassed[result.test_id] === 0);
    if (repeated.length > 0) {
      await deliver(settings, 'repeated', `${title}: тесты провалены второй раз подряд`, `${testList(repeated)}\n\n${link}`, log);
    }

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
