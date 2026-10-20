-- Регулярные и отложенные проверки.

-- Регулярность сценария. schedule_type = NULL - нерегулярный, запускается только вручную.
-- Типы расписания и их описание - в src/schedule.js.
ALTER TABLE scenarios ADD COLUMN schedule_type TEXT;       -- daily, hours, days, weekdays, weekends, monthly, quarterly
ALTER TABLE scenarios ADD COLUMN schedule_time TEXT;       -- время запуска по Москве, 'HH:MM'
ALTER TABLE scenarios ADD COLUMN schedule_number INTEGER;  -- сколько часов (hours), дней (days) или какое число месяца (monthly)
ALTER TABLE scenarios ADD COLUMN next_run_at TEXT;         -- UTC: когда поставить следующую регулярную проверку

-- Отложенная проверка: у сценария может быть одна
ALTER TABLE scenarios ADD COLUMN deferred_at TEXT;         -- UTC: когда запустить
ALTER TABLE scenarios ADD COLUMN deferred_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 1: проверку поставило расписание - для фильтра «Регулярность» в архиве
ALTER TABLE reports ADD COLUMN is_regular INTEGER NOT NULL DEFAULT 0;
