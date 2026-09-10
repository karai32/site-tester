// Скачивает HTML для списка страниц пакетами, определяя тип контента через HEAD перед GET
export async function* fetchPagesContent(request, pageUrls, { batchSize = 8, timeoutMs = 15_000 } = {}) {
  for (let index = 0; index < pageUrls.length; index += batchSize) {
    const batch = pageUrls.slice(index, index + batchSize);
    const results = await Promise.all(batch.map(async (pageUrl) => {
      try {
        const headResponse = await request.head(pageUrl, { failOnStatusCode: false, timeout: timeoutMs });
        const headStatus = headResponse.status();
        const headContentType = headResponse.headers()['content-type'] || '';
        await headResponse.dispose();

        const headUnsupported = headStatus === 405 || headStatus === 501;
        const looksLikeHtml = headStatus >= 200 && headStatus < 400 && headContentType.includes('text/html');

        if (!looksLikeHtml && !headUnsupported) {
          return [pageUrl, { status: headStatus, html: null }];
        }

        const response = await request.get(pageUrl, { failOnStatusCode: false, timeout: timeoutMs });
        const status = response.status();
        const contentType = response.headers()['content-type'] || '';
        const html = status >= 200 && status < 400 && contentType.includes('text/html') ? await response.text() : null;
        await response.dispose();
        return [pageUrl, { status, html }];
      } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
        return [pageUrl, { status: 0, html: null, error: message }];
      }
    }));

    for (const result of results) {
      yield result;
    }
  }
}

// Проверяет HTTP-статус для списка URL пакетами (HEAD, с откатом на GET, если HEAD не поддерживается)
export async function checkPagesStatus(request, pageUrls, { batchSize = 8, timeoutMs = 15_000 } = {}) {
  const results = new Map();

  for (let index = 0; index < pageUrls.length; index += batchSize) {
    const batch = pageUrls.slice(index, index + batchSize);
    await Promise.all(batch.map(async (pageUrl) => {
      try {
        const headResponse = await request.head(pageUrl, { failOnStatusCode: false, timeout: timeoutMs });
        let status = headResponse.status();
        await headResponse.dispose();

        if (status === 405 || status === 501) {
          const getResponse = await request.get(pageUrl, { failOnStatusCode: false, timeout: timeoutMs });
          status = getResponse.status();
          await getResponse.dispose();
        }

        results.set(pageUrl, { status });
      } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
        results.set(pageUrl, { status: 0, error: message });
      }
    }));
  }

  return results;
}

// Достаёт короткое читаемое сообщение из объекта ошибки или произвольного значения
export function errorMessage(error) {
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}

// Скрывает мешающие модалки и делает JPEG-скриншот страницы, возвращая его как data-URL
export async function captureScreenshot(page, { fullPage = false } = {}) {
  await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
  const buffer = await page.screenshot({ type: 'jpeg', quality: fullPage ? 45 : 60, fullPage });
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}
