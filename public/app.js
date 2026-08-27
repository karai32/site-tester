const siteLogoLinkElement = document.querySelector('#site-logo-link');
const siteLogoElement = document.querySelector('#site-logo');
const messageElement = document.querySelector('#message');
const statsElement = document.querySelector('#stats');
const groupsElement = document.querySelector('#check-groups');
const startButton = document.querySelector('#start-scan');
const scanHistoryElement = document.querySelector('#scan-history');
const lightboxElement = document.querySelector('#lightbox');
const lightboxContentElement = document.querySelector('#lightbox-content');
const lightboxCloseButton = document.querySelector('#lightbox-close');

const statusLabels = {
  pending: 'Ожидает запуска',
  running: 'Выполняется',
  passed: 'Пройдено',
  failed: 'Ошибка',
};

const problemsVisibleLimit = 6;

let groupDefinitions = [];
let objectUrls = [];

// === Blob URL lifecycle (для скриншотов и видео, которые приходят как base64) ===

// Освобождает все blob-ссылки, выданные на предыдущий рендер
function releaseObjectUrls() {
  for (const objectUrl of objectUrls) {
    URL.revokeObjectURL(objectUrl);
  }
  objectUrls = [];
}

// Превращает data:-URI (base64) в blob-ссылку, пригодную для <img>/<video>/лайтбокса
function dataUriToObjectUrl(dataUri) {
  const [header, base64] = dataUri.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
  objectUrls.push(objectUrl);
  return objectUrl;
}

// === Лайтбокс (просмотр скриншота крупным планом) ===

// Открывает скриншот на весь экран
function openLightbox(objectUrl, alt) {
  const img = element('img', 'lightbox-image');
  img.src = objectUrl;
  img.alt = alt;
  lightboxContentElement.replaceChildren(img);
  lightboxElement.hidden = false;
}

// Закрывает лайтбокс
function closeLightbox() {
  lightboxElement.hidden = true;
  lightboxContentElement.replaceChildren();
}

// === DOM-хелперы и рендеринг результатов ===

// Создаёт DOM-узел с классом и текстом за один вызов
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Кружок-иконка статуса конкретной проверки (✓/✕/•)
function statusIcon(status = 'pending') {
  return element('span', `status-icon status-icon--${status}`);
}

// Текстовая подпись статуса конкретной проверки
function statusText(status = 'pending') {
  return element('span', `status-text status-text--${status}`, statusLabels[status] || status);
}

// Плашка «пройдено/всего» в заголовке категории
function groupCountPill(group) {
  const total = group.checks.length;
  const passed = group.checks.filter((check) => check.status === 'passed').length;
  return element('span', `check-group-count check-group-count--${group.status}`, `${passed}/${total}`);
}

// Считает сводные цифры по всем категориям для плашек статистики
function computeStats(groups) {
  const checks = groups.flatMap((group) => group.checks);
  const total = checks.length;
  const passed = checks.filter((check) => check.status === 'passed').length;
  const failed = checks.filter((check) => check.status === 'failed').length;
  const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
  return { total, passed, failed, rate };
}

// Рисует плашки сводной статистики над списком категорий
function renderStats(groups) {
  const { total, passed, failed, rate } = computeStats(groups);
  const tiles = [
    { label: 'Всего проверок', value: total, modifier: '' },
    { label: 'Пройдено', value: passed, modifier: 'passed' },
    { label: 'Ошибок', value: failed, modifier: 'failed' },
    { label: 'Успешность', value: `${rate}%`, modifier: '' },
  ];

  statsElement.replaceChildren(
    ...tiles.map(({ label, value, modifier }) => {
      const tile = element('div', `stat-tile${modifier ? ` stat-tile--${modifier}` : ''}`);
      tile.append(
        element('div', 'stat-tile-value', String(value)),
        element('div', 'stat-tile-label', label),
      );
      return tile;
    }),
  );
}

// Список проблем: показывает первые N штук, остальные — по кнопке «показать все»
function appendProblemsList(item, problems) {
  const problemsList = element('ul', 'check-problems');
  const visible = problems.slice(0, problemsVisibleLimit);
  for (const problem of visible) {
    problemsList.append(element('li', '', problem));
  }
  item.append(problemsList);

  if (problems.length <= problemsVisibleLimit) return;

  let expanded = false;
  const toggle = element('button', 'check-problems-toggle', `Показать все ${problems.length}`);
  toggle.type = 'button';
  toggle.addEventListener('click', () => {
    expanded = !expanded;
    problemsList.replaceChildren(...(expanded ? problems : visible).map((problem) => element('li', '', problem)));
    toggle.textContent = expanded ? 'Свернуть' : `Показать все ${problems.length}`;
  });
  item.append(toggle);
}

// Скриншоты/видео проверки в виде миниатюр; клик по скриншоту открывает лайтбокс
function appendMedia(item, check) {
  const media = element('div', 'check-media');

  if (check.screenshot) {
    const objectUrl = dataUriToObjectUrl(check.screenshot);
    const thumb = element('button', 'check-thumb');
    thumb.type = 'button';
    const img = element('img');
    img.src = objectUrl;
    img.alt = `Скриншот: ${check.title}`;
    thumb.append(img);
    thumb.addEventListener('click', () => openLightbox(objectUrl, img.alt));
    media.append(thumb);
  }

  if (check.video) {
    const objectUrl = dataUriToObjectUrl(check.video);
    const video = element('video', 'check-video');
    video.src = objectUrl;
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    media.append(video);
  }

  if (Array.isArray(check.screenshots)) {
    for (const shot of check.screenshots) {
      const objectUrl = dataUriToObjectUrl(shot.image);
      const figure = element('figure', 'check-thumb-figure');
      const thumb = element('button', 'check-thumb');
      thumb.type = 'button';
      const img = element('img');
      img.src = objectUrl;
      img.alt = `Скриншот: ${check.title} — ${shot.label}`;
      thumb.append(img);
      thumb.addEventListener('click', () => openLightbox(objectUrl, img.alt));
      figure.append(thumb, element('figcaption', 'check-thumb-caption', shot.label));
      media.append(figure);
    }
  }

  if (media.childElementCount > 0) {
    item.append(media);
  }
}

// Рисует список категорий и проверок целиком (статистика, аккордеон, скриншоты, видео, ссылки)
function renderGroups(groups) {
  releaseObjectUrls();
  renderStats(groups);

  const accordions = groups.map((group) => {
    const details = element('details', 'check-group');
    details.open = true;

    const summary = element('summary');
    summary.append(
      element('span', 'check-group-title', group.title),
      groupCountPill(group),
    );

    const list = element('div', 'check-list');
    for (const check of group.checks) {
      const item = element('article', 'check-item');
      item.dataset.status = check.status || 'pending';

      const heading = element('div', 'check-item-heading');
      const titleRow = element('div', 'check-item-title-row');
      titleRow.append(statusIcon(check.status), element('h3', '', check.title));
      heading.append(titleRow, statusText(check.status));
      item.append(
        heading,
        element('p', 'check-output', check.message || 'Результат отсутствует.'),
      );

      if (Array.isArray(check.problems) && check.problems.length > 0) {
        appendProblemsList(item, check.problems);
      }

      const pageUrls = check.pageUrls || (check.pageUrl ? [check.pageUrl] : []);
      if (pageUrls.length > 0) {
        const pageLinksLine = element('p', 'check-page-links');
        pageLinksLine.append(element('span', 'check-page-links-label', pageUrls.length > 1 ? 'Страницы проверки: ' : 'Страница проверки: '));
        pageUrls.forEach((pageUrl, index) => {
          if (index > 0) pageLinksLine.append(', ');
          const link = element('a', '', pageUrl);
          link.href = pageUrl;
          link.target = '_blank';
          link.rel = 'noopener';
          pageLinksLine.append(link);
        });
        item.append(pageLinksLine);
      }

      appendMedia(item, check);

      list.append(item);
    }

    details.append(summary, list);
    return details;
  });

  groupsElement.replaceChildren(...accordions);
}

// === Селектор истории проверок ===

// Форматирует дату прогона в подпись вида «Проверка 20.08.2026 13:00»
function formatScanLabel(scan) {
  const date = new Date(scan.created_at);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `Проверка ${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

// Перезагружает список прогонов в выпадающем списке и выбирает нужный пункт
async function refreshScanHistory(selectedId) {
  const { scans } = await requestJson('/api/scans');
  scanHistoryElement.replaceChildren(
    ...scans.map((scan) => {
      const option = element('option', '', formatScanLabel(scan));
      option.value = scan.id;
      return option;
    }),
  );

  const idToSelect = selectedId ?? scans[0]?.id;
  if (idToSelect !== undefined) {
    scanHistoryElement.value = String(idToSelect);
  }

  return scans;
}

// === Состояние UI (сообщение, кнопка, заглушки статусов) ===

// Клонирует список категорий/проверок с одинаковым статусом и сообщением (для заглушек)
function groupsWithStatus(status, message) {
  return groupDefinitions.map((group) => ({
    ...group,
    status,
    checks: group.checks.map((check) => ({
      ...check,
      status,
      message,
    })),
  }));
}

// Текст под шапкой (обычный или об ошибке)
function setMessage(message, isError = false) {
  messageElement.textContent = message;
  messageElement.classList.toggle('error', isError);
}

// Блокирует кнопку запуска и меняет её подпись на время проверки
function setRunning(running) {
  startButton.disabled = running;
  startButton.textContent = running ? 'Проверка выполняется…' : 'Запустить проверку';
}

// === Сеть ===

// fetch с автоматическим парсингом JSON и выбросом ошибки на не-200 ответ
async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Ошибка запроса.');
  }

  return payload;
}

// === Сценарий проверки: запуск, поллинг, переключение между прогонами ===

// Показывает результат уже завершённого прогона (успех/ошибка + сами группы)
function renderCompletedScan(scan) {
  const groups = scan.report?.groups;
  renderGroups(
    groups?.length
      ? groups
      : groupsWithStatus('failed', 'Не удалось получить результат проверки.'),
  );
  setRunning(false);

  if (scan.status === 'passed') {
    setMessage('Проверка завершена успешно.');
  } else {
    setMessage(scan.error || 'Проверка завершена с ошибками.', true);
  }
}

// Опрашивает статус прогона до завершения, затем рендерит результат
async function followScan(scanId, showRunning = true) {
  if (showRunning) {
    setRunning(true);
    renderGroups(groupsWithStatus('running', 'Проверка выполняется…'));
    setMessage('Проверка выполняется…');
  }

  while (true) {
    const { scan } = await requestJson(`/api/scans/${scanId}`);

    if (scan.status !== 'pending' && scan.status !== 'running') {
      renderCompletedScan(scan);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
}

// При открытии страницы — подхватывает и показывает самый свежий прогон (если есть)
async function loadLatestScan() {
  const scans = await refreshScanHistory();
  const latest = scans[0];
  if (latest) {
    const isRunning = latest.status === 'pending' || latest.status === 'running';
    await followScan(latest.id, isRunning);
  }
}

// Обработчик клика по кнопке «Запустить проверку»
async function startScan() {
  setRunning(true);
  renderGroups(groupsWithStatus('running', 'Проверка выполняется…'));
  setMessage('Проверка запускается…');

  try {
    const { scan } = await requestJson('/api/scans', { method: 'POST' });
    await refreshScanHistory(scan.id);
    await followScan(scan.id, false);
    await refreshScanHistory(scan.id);
  } catch (error) {
    setRunning(false);
    renderGroups(groupsWithStatus('failed', 'Проверка не была выполнена.'));
    setMessage(error.message, true);
  }
}

// Обработчик выбора пункта в истории проверок
async function selectScanFromHistory() {
  const id = Number(scanHistoryElement.value);
  if (Number.isInteger(id) && id > 0) {
    await followScan(id, false);
  }
}

// === Точка входа ===

// Загружает настройки сайта и список проверок, затем подхватывает последний прогон
async function initialize() {
  try {
    const { site, groups } = await requestJson('/api/health');
    if (site.logoUrl) {
      siteLogoElement.src = site.logoUrl;
      siteLogoElement.alt = `Логотип: ${site.name}`;
      siteLogoLinkElement.href = site.url;
      siteLogoLinkElement.hidden = false;
    }
    groupDefinitions = groups;
    renderGroups(groupsWithStatus(
      'pending',
      'Запустите проверку, чтобы получить результат.',
    ));
    await loadLatestScan();
  } catch (error) {
    setMessage(error.message, true);
  }
}

startButton.addEventListener('click', startScan);
scanHistoryElement.addEventListener('change', selectScanFromHistory);
lightboxCloseButton.addEventListener('click', closeLightbox);
lightboxElement.addEventListener('click', (event) => {
  if (event.target === lightboxElement) closeLightbox();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !lightboxElement.hidden) closeLightbox();
});
initialize();
