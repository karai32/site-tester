ALTER TABLE projects ADD COLUMN login TEXT;
ALTER TABLE projects ADD COLUMN password_hash TEXT;
ALTER TABLE projects ADD COLUMN email TEXT;
ALTER TABLE projects ADD COLUMN telegram_id TEXT;
ALTER TABLE projects ADD COLUMN key_hash TEXT;
ALTER TABLE projects ADD COLUMN key_start TEXT;
ALTER TABLE projects ADD COLUMN key_created_at TEXT;
ALTER TABLE projects ADD COLUMN key_used_at TEXT;
CREATE UNIQUE INDEX projects_by_login ON projects (login);
CREATE UNIQUE INDEX projects_by_key ON projects (key_hash);

ALTER TABLE scenarios DROP COLUMN author_id;
ALTER TABLE scenarios DROP COLUMN deferred_by;
ALTER TABLE reports DROP COLUMN started_by;

DROP TABLE sessions;
DROP TABLE api_keys;
DROP TABLE users;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
