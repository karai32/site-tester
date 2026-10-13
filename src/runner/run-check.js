// Одна проверка: обходит сайт, запускает тесты сценария и записывает результаты в отчёт.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { DATA_DIR, MEDIA_DIR } from '../config.js';
import { findProjectById } from '../db/projects.js';
import { findReportById, markReportDone, markReportError, markReportRunning, saveTestResult, setReportPlan } from '../db/reports.js';
import { findScenarioById } from '../db/scenarios.js';
import { categories } from '../tests/index.js';
import { crawlSite, MAX_PAGES, readSavedHtml } from './crawl.js';
import { collectLinks, selectPages } from './page-sets.js';

const TEST_TIMEOUT_MS = 10 * 60 * 1000; // тест, который идёт дольше, считается проваленным

function firstLine(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

// Тесты сценария в порядке категорий: [{ category, test }]
function scenarioTests(scenario) {
  const list = [];
  for (const category of categories) {
    for (const test of category.tests) {
      if (scenario.is_full || scenario.test_ids.includes(test.id)) list.push({ category, test });
    }
  }
  return list;
}

// Запускает тест и приводит ответ к одному виду.
// Если тест упал с ошибкой или завис, он считается проваленным.
async function runTest(test, context) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`тест не уложился в ${TEST_TIMEOUT_MS / 60_000} минут`)), TEST_TIMEOUT_MS);
  });
  const running = test.run(context);
  running.catch(() => {}); // ошибка теста после тайм-аута уже никому не нужна

  try {
    const result = await Promise.race([running, timeout]);
    if (typeof result?.passed !== 'boolean') {
      throw new Error('тест должен вернуть объект с полем passed: true или false');
    }
    return {
      passed: result.passed,
      comment: result.comment || '',
      problems: result.problems || [],
      pages: result.pages || [context.siteUrl],
      media: result.media || [],
    };
  } catch (error) {
    return { passed: false, comment: `Тест не выполнен: ${firstLine(error)}`, problems: [], pages: [context.siteUrl], media: [] };
  } finally {
    clearTimeout(timer);
  }
}

// Тип файла по первым байтам: скриншоты бывают JPEG и PNG, видео — WebM
function fileExtension(data) {
  if (data[0] === 0x89) return 'png';
  if (data[0] === 0x1a && data[1] === 0x45) return 'webm';
  return 'jpg';
}

// Сохраняет медиафайлы теста. Возвращает [{ file, caption }], file — путь внутри папки media.
// Тест отдаёт файл как Buffer или как { data: Buffer, caption: 'подпись' }.
function saveMedia(reportId, testId, media) {
  mkdirSync(join(MEDIA_DIR, 'reports', String(reportId)), { recursive: true });

  return media.map((item, index) => {
    const data = Buffer.isBuffer(item) ? item : item.data;
    const file = `reports/${reportId}/${testId}-${index + 1}.${fileExtension(data)}`;
    writeFileSync(join(MEDIA_DIR, file), data);
    return { file, caption: Buffer.isBuffer(item) ? null : item.caption || null };
  });
}

// log — куда писать ход проверки: console в терминале или логгер сервера
export async function runCheck(reportId, log = console) {
  if (!markReportRunning(reportId)) return; // отчёт уже взят в работу

  const report = findReportById(reportId);
  const scenario = findScenarioById(report.scenario_id);
  const project = findProjectById(report.project_id);
  const htmlDir = join(DATA_DIR, 'cache', `report-${reportId}`);
  let browser;

  try {
    // 1. Обход сайта
    mkdirSync(htmlDir, { recursive: true });
    log.info(`Отчёт #${reportId}: обход сайта ${project.url}`);
    const site = await crawlSite(project.url, htmlDir);
    if (site.htmlPages.length === 0) {
      throw new Error(`Сайт ${project.url} недоступен: не найдено ни одной страницы`);
    }

    // 2. Страницы и тесты по сценарию
    const pages = selectPages(site.htmlPages, scenario.is_full ? ['all'] : scenario.page_sets, project.url);
    const links = collectLinks(pages, site.linksByPage, site.statuses);
    const tests = scenarioTests(scenario);
    setReportPlan(reportId, {
      pagesCount: pages.length,
      testsTotal: tests.length,
      note: site.truncated ? `Обход сайта остановлен на ${MAX_PAGES} адресах: на сайте могут быть и другие страницы` : null,
    });
    log.info(`Отчёт #${reportId}: найдено ${site.htmlPages.length} страниц, в выборке ${pages.length}, тестов ${tests.length}`);

    // 3. Тесты по одному
    browser = await chromium.launch();
    for (const { category, test } of tests) {
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
      await Promise.all(browser.contexts().map((context) => context.close().catch(() => {})));

      saveTestResult(reportId, {
        categoryId: category.id,
        categoryTitle: category.title,
        testId: test.id,
        testTitle: test.title,
        ...result,
        media: saveMedia(reportId, test.id, result.media),
        durationMs: Date.now() - startedAt,
      });
      log.info(`Отчёт #${reportId}: ${result.passed ? 'успешно' : 'провалено'} — ${test.id} (${Math.round((Date.now() - startedAt) / 1000)} с)`);
    }

    markReportDone(reportId);
    log.info(`Отчёт #${reportId}: готов`);
  } catch (error) {
    log.error(`Отчёт #${reportId}: ошибка — ${firstLine(error)}`);
    markReportError(reportId, firstLine(error));
  } finally {
    await browser?.close().catch(() => {});
    rmSync(htmlDir, { recursive: true, force: true });
  }
}
