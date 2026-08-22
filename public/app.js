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

      if (check.screenshot) {
        const screenshot = element('img', 'check-screenshot');
        screenshot.src = check.screenshot;
        screenshot.alt = `Скриншот: ${check.title}`;
        item.append(screenshot);
      }

      if (Array.isArray(check.screenshots)) {
        const gallery = element('div', 'check-screenshot-gallery');
        for (const shot of check.screenshots) {
          const figure = element('figure', 'check-screenshot-figure');
          const img = element('img', 'check-screenshot');
          img.src = shot.image;
          img.alt = `Скриншот: ${check.title} — ${shot.label}`;
          figure.append(img, element('figcaption', '', shot.label));
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
