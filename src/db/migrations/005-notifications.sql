-- Уведомления сценария: о каких событиях сообщать, каким способом (Telegram, почта) и кому.
-- JSON-текст, устройство описано в src/notifications/settings.js
ALTER TABLE scenarios ADD COLUMN notifications TEXT NOT NULL DEFAULT '{}';
