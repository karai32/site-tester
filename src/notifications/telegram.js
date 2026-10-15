// Telegram: отправка сообщений через бота и ответ бота «ваш Telegram ID».
// Бот пишет только тем, кто сам начал с ним диалог — поэтому в профиле подсказка «перейдите в бота».
import { TELEGRAM_BOT_NAME, TELEGRAM_BOT_TOKEN } from '../config.js';

const API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export function isTelegramConfigured() {
  return Boolean(TELEGRAM_BOT_TOKEN);
}

export async function sendTelegram(chatId, text) {
  const response = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
    signal: AbortSignal.timeout(15_000), // Telegram не ответил за 15 секунд — не ждём
  });
  if (!response.ok) {
    throw new Error(`Telegram ответил ${response.status}: ${await response.text()}`);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Бот отвечает на любое сообщение номером чата — это и есть Telegram ID для профиля.
// Работает постоянно: спрашивает у Telegram новые сообщения (long polling, ждёт до 50 секунд).
export async function startTelegramBot(log) {
  if (!isTelegramConfigured()) {
    log.info('Telegram-бот не настроен: нет TELEGRAM_BOT_TOKEN');
    return;
  }
  log.info(`Telegram-бот @${TELEGRAM_BOT_NAME} запущен`);

  let offset = 0; // номер следующего сообщения: старые Telegram больше не присылает
  while (true) {
    try {
      const response = await fetch(`${API}/getUpdates?timeout=50&offset=${offset}`, {
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
      await wait(10_000); // Telegram недоступен — пробуем снова через 10 секунд
    }
  }
}
