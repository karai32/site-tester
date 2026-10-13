-- Сценарии проверок и отчёты.
-- Списки (id тестов, выборки страниц, ошибки) хранятся как JSON-текст.

-- Сценарий: какие тесты запускать и на каких страницах
CREATE TABLE scenarios (
  id         INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL: сценарий создал сам сервис
  name       TEXT NOT NULL,
  revision   INTEGER NOT NULL DEFAULT 1,  -- редакция: #1, #2, ...
  is_full    INTEGER NOT NULL DEFAULT 0,  -- 1: полный сценарий, все тесты на всех страницах
  test_ids   TEXT NOT NULL DEFAULT '[]',  -- JSON: id выбранных тестов (у полного не используется)
  page_sets  TEXT NOT NULL DEFAULT '[]',  -- JSON: выборки страниц, см. src/runner/page-sets.js
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Отчёт: один запуск сценария
CREATE TABLE reports (
  id           INTEGER PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scenario_id  INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  started_by   INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL: запущен по расписанию или из терминала
  status       TEXT NOT NULL DEFAULT 'queued',                 -- queued, running, done, error
  error        TEXT,              -- почему проверка не выполнилась (status = error)
  note         TEXT,              -- предупреждение к отчёту, например «обход сайта остановлен на 4000 страниц»
  pages_count  INTEGER,           -- сколько страниц попало в выборку
  tests_total  INTEGER,
  tests_done   INTEGER NOT NULL DEFAULT 0,
  tests_passed INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  started_at   TEXT,
  finished_at  TEXT
);
CREATE INDEX reports_by_project ON reports (project_id, id);

-- Результат одного теста в отчёте.
-- Названия теста и категории копируются, чтобы старые отчёты не менялись, когда тесты правят.
CREATE TABLE report_results (
  id             INTEGER PRIMARY KEY,
  report_id      INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  category_id    TEXT NOT NULL,
  category_title TEXT NOT NULL,
  test_id        TEXT NOT NULL,
  test_title     TEXT NOT NULL,
  passed         INTEGER NOT NULL,           -- 1: успешно, 0: провалено
  comment        TEXT,                       -- комментарий проверки
  problems       TEXT NOT NULL DEFAULT '[]', -- JSON: найденные ошибки
  pages          TEXT NOT NULL DEFAULT '[]', -- JSON: ссылки на проверенные страницы
  media          TEXT NOT NULL DEFAULT '[]', -- JSON: скриншоты и видео, файлы в папке data/media
  duration_ms    INTEGER
);
CREATE INDEX report_results_by_report ON report_results (report_id);
CREATE INDEX report_results_by_test ON report_results (test_id, report_id);
