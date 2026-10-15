// Одна проверка: обходит сайт, запускает тесты сценария и записывает результаты в отчёт.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { DATA_DIR, MEDIA_DIR } from '../config.js';
import { findProjectById } from '../db/projects.js';
import {
  findReportById,
  isReportCancelled,
  markReportDone,
  markReportError,
  markReportRunning,
  saveTestResult,
  setReportPlan,
} from '../db/reports.js';
import { findScenarioById } from '../db/scenarios.js';
import { notifyCheckFinished, notifyCheckStarted } from '../notifications/notify.js';
import { scenarioPageSetIds, scenarioTestIds } from '../scenario-info.js';
import { categories } from '../tests/index.js';
import { crawlSite, MAX_PAGES, readSavedHtml } from './crawl.js';
import { collectLinks, selectPages } from './page-sets.js';

const TEST_TIMEOUT_MS = 10 * 60 * 1000; // тест, который идёт дольше 10 минут, считается проваленным

// Первая строка текста ошибки
function firstLine(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text.split('\n')[0];
}

// Тесты сценария в порядке категорий: [{ category, test }]
function scenarioTests(scenario) {
  const testIds = scenarioTestIds(scenario);
  const list = [];
  for (const category of categories) {
    for (const test of category.tests) {
      if (testIds.includes(test.id)) list.push({ category, test });
    }
  }
  return list;
}

// Ждёт выполнения promise, но не дольше ms миллисекунд. Не успел — ошибка.
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`тест не уложился в ${ms / 60_000} минут`)), ms);
  });
  // Promise.race ждёт того, кто закончит первым: тест или таймер
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Результат проваленного теста с комментарием
function failedResult(comment) {
  return { passed: false, comment, problems: [], pages: [], media: [] };
}

// Запускает тест и приводит его ответ к одному виду.
// Если тест упал с ошибкой, завис или вернул что-то не то, он считается проваленным.
async function runTest(test, context) {
  let result;
  try {
    const running = test.run(context);
    running.catch(() => {}); // если тест упадёт уже после тайм-аута, эта ошибка никому не нужна
    result = await withTimeout(running, TEST_TIMEOUT_MS);
  } catch (error) {
    return failedResult(`Тест не выполнен: ${firstLine(error)}`);
  }

  if (!result || typeof result.passed !== 'boolean') {
    return failedResult('Тест не выполнен: тест должен вернуть объект с полем passed: true или false');
  }

  return {
    passed: result.passed,
    comment: result.comment || '',
    problems: result.problems || [],
    pages: result.pages || [],
    media: result.media || [],
  };
}

// Тип файла по первым байтам: скриншоты бывают JPEG и PNG, видео — WebM
function fileExtension(data) {
  if (data[0] === 0x89) return 'png';
  if (data[0] === 0x1a && data[1] === 0x45) return 'webm';
  return 'jpg';
}

// Сохраняет медиафайлы теста. Возвращает [{ file, caption }], file — путь внутри папки media.
// Тест отдаёт файл просто как Buffer или с подписью: { data: Buffer, caption: 'подпись' }.
function saveMedia(reportId, testId, media) {
  mkdirSync(join(MEDIA_DIR, 'reports', String(reportId)), { recursive: true });

  const saved = [];
  for (let index = 0; index < media.length; index += 1) {
    let data = media[index];
    let caption = null;
    if (!Buffer.isBuffer(data)) {
      caption = data.caption || null;
      data = data.data;
    }

    const file = `reports/${reportId}/${testId}-${index + 1}.${fileExtension(data)}`;
    writeFileSync(join(MEDIA_DIR, file), data);
    saved.push({ file, caption });
  }
  return saved;
}

// log — куда писать ход проверки: console в терминале или логгер сервера
export async function runCheck(reportId, log = console) {
  if (!markReportRunning(reportId)) return; // отчёт уже взят в работу

  const report = findReportById(reportId);
  const scenario = findScenarioById(report.scenario_id);
  const project = findProjectById(report.project_id);
  const htmlDir = join(DATA_DIR, 'cache', `report-${reportId}`);
  let browser;

  await notifyCheckStarted(reportId, log);

  try {
    // 1. Обход сайта
    mkdirSync(htmlDir, { recursive: true });
    log.info(`Отчёт #${reportId}: обход сайта ${project.url}`);
    const cancelled = () => isReportCancelled(reportId);
    const site = await crawlSite(project.url, htmlDir, cancelled);
    if (cancelled()) {
      log.info(`Отчёт #${reportId}: отменён`);
      return;
    }
    if (site.htmlPages.length === 0) {
      throw new Error(`Сайт ${project.url} недоступен: не найдено ни одной страницы`);
    }

    // 2. Страницы и тесты по сценарию
    const pages = selectPages(site.htmlPages, scenarioPageSetIds(scenario), project.url);
    const links = collectLinks(pages, site.linksByPage, site.statuses);
    const tests = scenarioTests(scenario);

    let note = null;
    if (site.truncated) note = `Обход сайта остановлен на ${MAX_PAGES} адресах: на сайте могут быть и другие страницы`;

    setReportPlan(reportId, {
      pagesCount: pages.length,
      sitePagesCount: site.htmlPages.length,
      testsTotal: tests.length,
      note,
    });
    log.info(`Отчёт #${reportId}: найдено ${site.htmlPages.length} страниц, в выборке ${pages.length}, тестов ${tests.length}`);

    // 3. Тесты по одному
    browser = await chromium.launch();
    for (const { category, test } of tests) {
      if (cancelled()) {
        log.info(`Отчёт #${reportId}: отменён`);
        return;
      }
      if (!browser.isConnected()) browser = await chromium.launch(); // браузер мог упасть в прошлом тесте

      const startedAt = Date.now();
      const result = await runTest(test, {
        siteUrl: project.url,
        pages,
        links,
        browser,
        getHtml: (url) => readSavedHtml(htmlDir, url),
      });
      // Закрываем вкладки, которые открыл тест
      for (const openedContext of browser.contexts()) {
        await openedContext.close().catch(() => {});
      }

      const durationMs = Date.now() - startedAt;
      saveTestResult(reportId, {
        categoryId: category.id,
        categoryTitle: category.title,
        testId: test.id,
        testTitle: test.title,
        passed: result.passed,
        comment: result.comment,
        problems: result.problems,
        pages: result.pages,
        media: saveMedia(reportId, test.id, result.media),
        durationMs,
      });

      const status = result.passed ? 'успешно' : 'провалено';
      log.info(`Отчёт #${reportId}: ${status} — ${test.id} (${Math.round(durationMs / 1000)} с)`);
    }

    markReportDone(reportId);
    log.info(`Отчёт #${reportId}: готов`);
  } catch (error) {
    log.error(`Отчёт #${reportId}: ошибка — ${firstLine(error)}`);
    markReportError(reportId, firstLine(error));
  } finally {
    if (browser) await browser.close().catch(() => {});
    rmSync(htmlDir, { recursive: true, force: true }); // HTML страниц больше не нужен
  }

  // Итог проверки — по настройкам уведомлений сценария. Об отменённой не сообщаем.
  await notifyCheckFinished(reportId, log);
}
