// Общие функции для тестов
import { request } from 'playwright';

// Короткий текст ошибки: первая строка сообщения
export function errorMessage(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

// Скриншот страницы в JPEG. Перед снимком прячет всплывающие окна сайта, кроме формы звонка.
export async function takeScreenshot(page, { fullPage = false } = {}) {
  await page.addStyleTag({ content: '.modal.js-modal.--open:not(#call) { display: none !important; }' }).catch(() => {});
  return page.screenshot({ type: 'jpeg', quality: fullPage ? 45 : 60, fullPage });
}

// HTTP-статусы адресов. Возвращает Map: адрес → { status, error }.
// Сначала HEAD, а если сервер его не поддерживает (405, 501) — GET.
export async function getStatuses(urls, { batchSize = 8, timeoutMs = 15_000 } = {}) {
  const results = new Map();
  const api = await request.newContext();

  try {
    for (let index = 0; index < urls.length; index += batchSize) {
      const batch = urls.slice(index, index + batchSize);
      await Promise.all(batch.map(async (url) => {
        try {
          const head = await api.head(url, { failOnStatusCode: false, timeout: timeoutMs });
          let status = head.status();
          await head.dispose();

          if (status === 405 || status === 501) {
            const get = await api.get(url, { failOnStatusCode: false, timeout: timeoutMs });
            status = get.status();
            await get.dispose();
          }
          results.set(url, { status, error: null });
        } catch (error) {
          results.set(url, { status: 0, error: errorMessage(error) });
        }
      }));
    }
  } finally {
    await api.dispose();
  }

  return results;
}
