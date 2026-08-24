const siteElement = document.querySelector('#site');
const messageElement = document.querySelector('#message');
const groupsElement = document.querySelector('#check-groups');
const startButton = document.querySelector('#start-scan');

const statusLabels = {
  pending: 'Ожидает запуска',
  running: 'Выполняется',
  passed: 'Пройдено',
  failed: 'Ошибка',
};

let groupDefinitions = [];
let objectUrls = [];

function releaseObjectUrls() {
  for (const objectUrl of objectUrls) {
    URL.revokeObjectURL(objectUrl);
  }
  objectUrls = [];
}

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

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statusBadge(status = 'pending') {
  return element(
    'span',
    `status status-${status}`,
    statusLabels[status] || status,
  );
}

function renderGroups(groups) {
  releaseObjectUrls();

  const accordions = groups.map((group) => {
    const details = element('details', 'check-group');
    details.open = true;

    const summary = element('summary');
    summary.append(
      element('span', 'check-group-title', group.title),
      statusBadge(group.status),
    );

    const list = element('div', 'check-list');
    for (const check of group.checks) {
      const item = element('article', 'check-item');
      const heading = element('div', 'check-item-heading');
      heading.append(element('h3', '', check.title), statusBadge(check.status));
      item.append(
        heading,
        element('p', 'check-output', check.message || 'Результат отсутствует.'),
      );

      if (Array.isArray(check.problems) && check.problems.length > 0) {
        const problemsList = element('ul', 'check-problems');
        for (const problem of check.problems) {
          problemsList.append(element('li', '', problem));
        }
        item.append(problemsList);
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

      if (check.screenshot) {
        const objectUrl = dataUriToObjectUrl(check.screenshot);
        const link = element('a', 'check-screenshot-link');
        link.href = objectUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        const screenshot = element('img', 'check-screenshot');
        screenshot.src = objectUrl;
        screenshot.alt = `Скриншот: ${check.title}`;
        link.append(screenshot);
        item.append(link);
      }

      if (Array.isArray(check.screenshots)) {
        const gallery = element('div', 'check-screenshot-gallery');
        for (const shot of check.screenshots) {
          const objectUrl = dataUriToObjectUrl(shot.image);
          const figure = element('figure', 'check-screenshot-figure');
          const link = element('a', 'check-screenshot-link');
          link.href = objectUrl;
          link.target = '_blank';
          link.rel = 'noopener';
          const img = element('img', 'check-screenshot');
          img.src = objectUrl;
          img.alt = `Скриншот: ${check.title} — ${shot.label}`;
          link.append(img);
          figure.append(link, element('figcaption', '', shot.label));
          gallery.append(figure);
        }
        item.append(gallery);
      }

      list.append(item);
    }

    details.append(summary, list);
    return details;
  });

  groupsElement.replaceChildren(...accordions);
}

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

function setMessage(message, isError = false) {
  messageElement.textContent = message;
  messageElement.classList.toggle('error', isError);
}

function setRunning(running) {
  startButton.disabled = running;
  startButton.textContent = running ? 'Проверка выполняется…' : 'Запустить проверку';
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Ошибка запроса.');
  }

  return payload;
}

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

async function loadLatestScan() {
  const { scans } = await requestJson('/api/scans');
  const latest = scans[0];
  if (latest) {
    const isRunning = latest.status === 'pending' || latest.status === 'running';
    await followScan(latest.id, isRunning);
  }
}

async function startScan() {
  setRunning(true);
  renderGroups(groupsWithStatus('running', 'Проверка выполняется…'));
  setMessage('Проверка запускается…');

  try {
    const { scan } = await requestJson('/api/scans', { method: 'POST' });
    await followScan(scan.id, false);
  } catch (error) {
    setRunning(false);
    renderGroups(groupsWithStatus('failed', 'Проверка не была выполнена.'));
    setMessage(error.message, true);
  }
}

async function initialize() {
  try {
    const { site, groups } = await requestJson('/api/health');
    siteElement.textContent = `${site.name}: ${site.url}`;
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
initialize();
