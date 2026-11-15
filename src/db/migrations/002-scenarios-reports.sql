CREATE TABLE scenarios (
  id         INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  revision   INTEGER NOT NULL DEFAULT 1,
  is_full    INTEGER NOT NULL DEFAULT 0,
  test_ids   TEXT NOT NULL DEFAULT '[]',
  page_sets  TEXT NOT NULL DEFAULT '[]',
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE reports (
  id           INTEGER PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scenario_id  INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  started_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'queued',
  error        TEXT,
  note         TEXT,
  pages_count  INTEGER,
  tests_total  INTEGER,
  tests_done   INTEGER NOT NULL DEFAULT 0,
  tests_passed INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  started_at   TEXT,
  finished_at  TEXT
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
