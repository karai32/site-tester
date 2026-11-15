ALTER TABLE scenarios ADD COLUMN schedule_type TEXT;
ALTER TABLE scenarios ADD COLUMN schedule_time TEXT;
ALTER TABLE scenarios ADD COLUMN schedule_number INTEGER;
ALTER TABLE scenarios ADD COLUMN next_run_at TEXT;

ALTER TABLE scenarios ADD COLUMN deferred_at TEXT;
ALTER TABLE scenarios ADD COLUMN deferred_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE reports ADD COLUMN is_regular INTEGER NOT NULL DEFAULT 0;
