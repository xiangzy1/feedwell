import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { copyFileSync } from 'fs'

let db: Database.Database

const SCHEMA_VERSION = 5

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS folders (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    sort_order  INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS feeds (
    id               INTEGER PRIMARY KEY,
    title            TEXT NOT NULL,
    url              TEXT NOT NULL UNIQUE,
    site_url         TEXT,
    folder_id        INTEGER REFERENCES folders(id),
    favicon_url      TEXT,
    open_in_browser  BOOLEAN DEFAULT 0,
    refresh_interval INTEGER DEFAULT 30,
    last_fetched_at  TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS articles (
    id           INTEGER PRIMARY KEY,
    feed_id      INTEGER NOT NULL REFERENCES feeds(id),
    title        TEXT NOT NULL,
    url          TEXT,
    author       TEXT,
    content      TEXT,
    summary      TEXT,
    guid         TEXT NOT NULL,
    read         BOOLEAN DEFAULT 0,
    starred      BOOLEAN DEFAULT 0,
    published_at TEXT,
    fetched_at   TEXT DEFAULT (datetime('now')),
    UNIQUE(feed_id, guid)
  )`,
  `CREATE TABLE IF NOT EXISTS fetch_logs (
    id             INTEGER PRIMARY KEY,
    feed_id        INTEGER NOT NULL REFERENCES feeds(id),
    status         TEXT NOT NULL,
    error_msg      TEXT,
    articles_count INTEGER DEFAULT 0,
    response_time  INTEGER,
    fetched_at     TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
  )`,
  `CREATE TABLE IF NOT EXISTS translations (
    id            INTEGER PRIMARY KEY,
    article_id    INTEGER NOT NULL,
    target_lang   TEXT NOT NULL,
    source_hash   TEXT NOT NULL,
    original_text TEXT NOT NULL,
    translated    TEXT NOT NULL,
    provider      TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now')),
    UNIQUE(article_id, target_lang, source_hash)
  )`
]

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'feeds.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  runMigrations()
  cleanOldFetchLogs()
  backupIfNeeded(dbPath)
}

function runMigrations(): void {
  db.exec('BEGIN')
  try {
    for (const sql of MIGRATIONS) {
      db.exec(sql)
    }

    const row = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined
    if (!row || row.version < 2) {
      try {
        db.exec('ALTER TABLE feeds ADD COLUMN webview_max_width INTEGER DEFAULT NULL')
      } catch { /* column already exists */ }
    }

    if (!row || row.version < 3) {
      try {
        db.exec('ALTER TABLE feeds ADD COLUMN favicon_cached TEXT DEFAULT NULL')
      } catch { /* column already exists */ }
    }

    if (!row || row.version < 4) {
      db.exec(`CREATE TABLE IF NOT EXISTS summaries (
        id          INTEGER PRIMARY KEY,
        article_id  INTEGER NOT NULL,
        target_lang TEXT NOT NULL,
        summary     TEXT NOT NULL,
        created_at  TEXT DEFAULT (datetime('now')),
        UNIQUE(article_id, target_lang)
      )`)
    }

    if (!row || row.version < 5) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_articles_feed_published ON articles(feed_id, published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_articles_read_published ON articles(read, published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_articles_starred_published ON articles(starred, published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_fetch_logs_fetched_at ON fetch_logs(fetched_at);
        CREATE INDEX IF NOT EXISTS idx_translations_lookup ON translations(article_id, target_lang, source_hash);
      `)
      try {
        db.exec('ALTER TABLE feeds ADD COLUMN last_etag TEXT DEFAULT NULL')
      } catch { /* column already exists */ }
      try {
        db.exec('ALTER TABLE feeds ADD COLUMN last_modified TEXT DEFAULT NULL')
      } catch { /* column already exists */ }
    }

    db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

function cleanOldFetchLogs(): void {
  db.prepare(
    "DELETE FROM fetch_logs WHERE fetched_at < datetime('now', '-90 days')"
  ).run()
}

function backupIfNeeded(dbPath: string): void {
  const backupPath = dbPath + '.bak'
  const settings = db.prepare("SELECT value FROM settings WHERE key = 'last_backup'").get() as { value: string } | undefined
  const lastBackup = settings?.value
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  if (!lastBackup || lastBackup < oneWeekAgo) {
    copyFileSync(dbPath, backupPath)
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_backup', ?)").run(new Date().toISOString())
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}
