// Почта: отправка писем через SMTP-сервер (библиотека nodemailer).
import nodemailer from 'nodemailer';
import { SMTP_FROM, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_USER } from '../config.js';

let transport = null; // подключение к SMTP-серверу, создаётся при первом письме

export function isEmailConfigured() {
  return Boolean(SMTP_HOST);
}

export async function sendEmail(to, subject, text) {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // порт 465 - сразу шифрованное соединение, 587 - шифрование по ходу
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  await transport.sendMail({ from: SMTP_FROM, to, subject, text });
}
