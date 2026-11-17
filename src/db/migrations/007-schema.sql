CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  login         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  email         TEXT,
  telegram_id   TEXT,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE api_keys (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  key_start    TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);

CREATE TABLE projects (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  logo       TEXT
);

CREATE TABLE scenarios (
  id              INTEGER PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  revision        INTEGER NOT NULL DEFAULT 1,
  is_full         INTEGER NOT NULL DEFAULT 0,
  test_ids        TEXT NOT NULL DEFAULT '[]',
  page_sets       TEXT NOT NULL DEFAULT '[]',
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  root_id         INTEGER REFERENCES scenarios(id) ON DELETE SET NULL,
  schedule_type   TEXT,
  schedule_time   TEXT,
  schedule_number INTEGER,
  next_run_at     TEXT,
  deferred_at     TEXT,
  deferred_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notifications   TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE reports (
  id               INTEGER PRIMARY KEY,
  project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scenario_id      INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  started_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'queued',
  error            TEXT,
  note             TEXT,
  pages_count      INTEGER,
  tests_total      INTEGER,
  tests_done       INTEGER NOT NULL DEFAULT 0,
  tests_passed     INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  started_at       TEXT,
  finished_at      TEXT,
  site_pages_count INTEGER,
  is_regular       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX reports_by_project ON reports (project_id, id);

CREATE TABLE report_results (
  id             INTEGER PRIMARY KEY,
  report_id      INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  category_id    TEXT NOT NULL,
  category_title TEXT NOT NULL,
  test_id        TEXT NOT NULL,
  test_title     TEXT NOT NULL,
  passed         INTEGER NOT NULL,
  comment        TEXT,
  problems       TEXT NOT NULL DEFAULT '[]',
  pages          TEXT NOT NULL DEFAULT '[]',
  media          TEXT NOT NULL DEFAULT '[]',
  duration_ms    INTEGER
);
CREATE INDEX report_results_by_report ON report_results (report_id);
CREATE INDEX report_results_by_test ON report_results (test_id, report_id);
