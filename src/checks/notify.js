import nodemailer from 'nodemailer';
import {
  APP_URL,
  SMTP_FROM,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_USER,
  TELEGRAM_BOT_NAME,
  TELEGRAM_BOT_TOKEN,
} from '../config.js';
import { findProjectById } from '../db/projects.js';
import { findPreviousDoneReport, findReportById, getReportResults } from '../db/reports.js';
import { findScenarioById } from '../db/scenarios.js';
import { percentOf } from '../logic/format.js';

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

function isTelegramConfigured() {
  return Boolean(TELEGRAM_BOT_TOKEN);
}

async function sendTelegram(chatId, text) {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Telegram ответил ${response.status}: ${await response.text()}`);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startTelegramBot(log) {
  if (!isTelegramConfigured()) {
    log.info('Telegram-бот не настроен: нет TELEGRAM_BOT_TOKEN');
    return;
  }
  log.info(`Telegram-бот @${TELEGRAM_BOT_NAME} запущен`);

  let offset = 0;
  while (true) {
    try {
      const response = await fetch(`${TELEGRAM_API}/getUpdates?timeout=50&offset=${offset}`, {
        signal: AbortSignal.timeout(60_000),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.description);

      for (const update of data.result) {
        offset = update.update_id + 1;
        if (!update.message) continue;

        const chatId = update.message.chat.id;
        await sendTelegram(chatId, `Ваш Telegram ID: ${chatId}\n\nУкажите его в профиле 808 Checker, чтобы получать уведомления о проверках.`);
      }
    } catch (error) {
      log.error(`Telegram-бот: ${error.message}`);
      await wait(10_000);
    }
  }
}

let transport = null;

function isEmailConfigured() {
  return Boolean(SMTP_HOST);
}

async function sendEmail(to, subject, text) {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  await transport.sendMail({ from: SMTP_FROM, to, subject, text });
}

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
