CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY,
 slug TEXT UNIQUE NOT NULL,
 title TEXT NOT NULL,
 location TEXT,
 category TEXT,
 year INTEGER,
 status TEXT,
 excerpt TEXT,
 cover_key TEXT,
 construction_stage TEXT,
 construction_note TEXT,
 reena_note TEXT,
 published INTEGER DEFAULT 0,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS project_media (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 r2_key TEXT NOT NULL,
 size_bytes INTEGER NOT NULL,
 sort_order INTEGER DEFAULT 0,
 FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS journal (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 category TEXT,
 date TEXT,
 intro TEXT,
 cover_key TEXT,
 published INTEGER DEFAULT 0,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS journal_media (
 id TEXT PRIMARY KEY,
 journal_id TEXT NOT NULL,
 r2_key TEXT NOT NULL,
 size_bytes INTEGER NOT NULL,
 sort_order INTEGER DEFAULT 0,
 FOREIGN KEY(journal_id) REFERENCES journal(id) ON DELETE CASCADE
);
-- Ledger of every object actually sitting in R2, used for real-time quota
-- accounting (7 GB cap) and to know what to delete when media is removed.
CREATE TABLE IF NOT EXISTS media_objects (
 key TEXT PRIMARY KEY,
 size_bytes INTEGER NOT NULL,
 content_type TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_media_project ON project_media(project_id);
CREATE INDEX IF NOT EXISTS idx_journal_media_journal ON journal_media(journal_id);
CREATE INDEX IF NOT EXISTS idx_projects_published ON projects(published);
