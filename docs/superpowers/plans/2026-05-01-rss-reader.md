# RSS Reader for macOS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS RSS reader with Electron + React + TypeScript, featuring a NetNewsWire-style three-pane layout, subscription statistics, and per-feed configuration.

**Architecture:** Electron main process handles SQLite storage, RSS fetching, and scheduling. Renderer is a React SPA with three-pane layout communicating via contextBridge IPC. Stats shown in a separate BrowserWindow. SQLite stores feeds, articles, fetch logs for statistics.

**Tech Stack:** Electron, electron-vite, React 19, TypeScript, better-sqlite3, feedparser, react-virtuoso, pnpm

---

## File Map

### Main Process

| File | Responsibility |
|------|---------------|
| `src/main/index.ts` | Electron app entry, lifecycle, window creation |
| `src/main/db/index.ts` | SQLite connection, schema migration, WAL mode, integrity check |
| `src/main/services/feed-fetcher.ts` | HTTP fetch + feedparser parse + HTML auto-discovery |
| `src/main/services/scheduler.ts` | Per-feed setTimeout-based refresh scheduler |
| `src/main/services/opml.ts` | OPML XML import/export |
| `src/main/ipc/feeds.ts` | IPC handlers for feed CRUD |
| `src/main/ipc/articles.ts` | IPC handlers for article queries |
| `src/main/ipc/folders.ts` | IPC handlers for folder CRUD |
| `src/main/ipc/stats.ts` | IPC handlers for statistics queries |
| `src/main/ipc/settings.ts` | IPC handlers for settings get/set |
| `src/main/ipc/opml.ts` | IPC handlers for OPML import/export |
| `src/main/windows/main.ts` | Main BrowserWindow creation + config |
| `src/main/windows/stats.ts` | Stats BrowserWindow creation + config |

### Preload

| File | Responsibility |
|------|---------------|
| `src/preload/index.ts` | contextBridge exposing typed API to renderer |

### Renderer

| File | Responsibility |
|------|---------------|
| `src/renderer/index.html` | HTML entry |
| `src/renderer/src/main.tsx` | React root mount |
| `src/renderer/src/App.tsx` | Root layout (three-pane) |
| `src/renderer/src/components/Sidebar/Sidebar.tsx` | Feed list + smart feeds + folders |
| `src/renderer/src/components/Sidebar/AddFeedDialog.tsx` | Modal for adding new feed |
| `src/renderer/src/components/Sidebar/SidebarItem.tsx` | Single feed/folder row |
| `src/renderer/src/components/ArticleList/ArticleList.tsx` | Virtual list of articles |
| `src/renderer/src/components/ArticleList/ArticleRow.tsx` | Single article row |
| `src/renderer/src/components/ArticleView/ArticleView.tsx` | Full article HTML rendering |
| `src/renderer/src/components/ArticleView/ArticleHeader.tsx` | Title, meta, action buttons |
| `src/renderer/src/hooks/useFeeds.ts` | Feed state + IPC calls |
| `src/renderer/src/hooks/useArticles.ts` | Article state + pagination |
| `src/renderer/src/hooks/useShortcuts.ts` | Keyboard shortcut handler |
| `src/renderer/src/styles/global.css` | Global styles + CSS variables |
| `src/renderer/src/styles/sidebar.css` | Sidebar styles |
| `src/renderer/src/styles/article-list.css` | Article list styles |
| `src/renderer/src/styles/article-view.css` | Article view styles |

### Stats Window (Renderer)

| File | Responsibility |
|------|---------------|
| `src/renderer-stats/index.html` | Stats window HTML entry |
| `src/renderer-stats/src/main.tsx` | React root mount for stats |
| `src/renderer-stats/src/App.tsx` | Stats layout |
| `src/renderer-stats/src/components/OverviewCards.tsx` | Summary cards |
| `src/renderer-stats/src/components/MonthlyChart.tsx` | Monthly trend chart |
| `src/renderer-stats/src/components/HealthTable.tsx` | Per-feed health table |
| `src/renderer-stats/src/components/AnomalyFilter.tsx` | Filter tabs + list |
| `src/renderer-stats/src/hooks/useStats.ts` | Stats data + IPC calls |
| `src/renderer-stats/src/styles/stats.css` | Stats window styles |

### Config & Build

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies, scripts |
| `electron.vite.config.ts` | electron-vite config (main/preload/renderer/renderer-stats) |
| `tsconfig.json` | Base TS config |
| `tsconfig.node.json` | TS config for main/preload |
| `tsconfig.web.json` | TS config for renderer |
| `electron-builder.yml` | macOS DMG build config |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `electron-builder.yml`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/styles/global.css`
- Create: `.gitignore`

- [ ] **Step 1: Initialize project with pnpm and install dependencies**

```bash
cd /Users/xzy/Code/Self/rss-reader
pnpm init
pnpm add -D electron electron-vite electron-builder
pnpm add react react-dom
pnpm add -D @types/react @types/react-dom typescript @vitejs/plugin-react
pnpm add better-sqlite3 feedparser
pnpm add -D @types/better-sqlite3
pnpm add react-virtuoso
```

- [ ] **Step 2: Create tsconfig files**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "outDir": "./out",
    "resolveJsonModule": true,
    "strict": true,
    "target": "ESNext",
    "lib": ["ESNext"],
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/preload/**/*", "electron.vite.config.ts"]
}
```

`tsconfig.web.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "outDir": "./out",
    "resolveJsonModule": true,
    "strict": true,
    "target": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"]
  },
  "include": ["src/renderer/**/*", "src/renderer-stats/**/*"]
}
```

- [ ] **Step 3: Create electron-vite config**

`electron.vite.config.ts`:
```ts
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main'
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload'
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: resolve('src/renderer/index.html')
      }
    },
    plugins: [react()]
  }
})
```

- [ ] **Step 4: Create .gitignore**

`.gitignore`:
```
node_modules/
out/
dist/
.DS_Store
*.db
*.db-journal
*.db-wal
*.db-shm
.superpowers/
```

- [ ] **Step 5: Create main process entry**

`src/main/index.ts`:
```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { initDatabase } from './db'

app.whenReady().then(() => {
  initDatabase()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.loadFile(join(__dirname, '../renderer/index.html'))
}
```

- [ ] **Step 6: Create preload**

`src/preload/index.ts`:
```ts
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  feeds: {
    add: (url: string, folderId?: number) => ipcRenderer.invoke('feeds:add', url, folderId),
    remove: (id: number) => ipcRenderer.invoke('feeds:remove', id),
    update: (id: number, changes: Record<string, unknown>) => ipcRenderer.invoke('feeds:update', id, changes),
    list: () => ipcRenderer.invoke('feeds:list'),
    refresh: (id?: number) => ipcRenderer.invoke('feeds:refresh', id)
  },
  articles: {
    list: (feedId?: number, options?: Record<string, unknown>) => ipcRenderer.invoke('articles:list', feedId, options),
    markRead: (id: number) => ipcRenderer.invoke('articles:markRead', id),
    markStarred: (id: number, starred: boolean) => ipcRenderer.invoke('articles:markStarred', id, starred)
  },
  folders: {
    create: (name: string) => ipcRenderer.invoke('folders:create', name),
    reorder: (orderedIds: number[]) => ipcRenderer.invoke('folders:reorder', orderedIds)
  },
  opml: {
    import: (filePath?: string) => ipcRenderer.invoke('opml:import', filePath),
    export: () => ipcRenderer.invoke('opml:export')
  },
  stats: {
    getMonthly: (feedId?: number, months?: number) => ipcRenderer.invoke('stats:getMonthly', feedId, months),
    getFeedHealth: () => ipcRenderer.invoke('stats:getFeedHealth')
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value)
  },
  onFeedsUpdated: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('feeds:updated', handler)
    return () => ipcRenderer.removeListener('feeds:updated', handler)
  },
  onArticlesUpdated: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('articles:updated', handler)
    return () => ipcRenderer.removeListener('articles:updated', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 7: Create renderer files**

`src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RSS Reader</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./src/main.tsx"></script>
</body>
</html>
```

`src/renderer/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/renderer/src/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">sidebar</aside>
      <div className="article-list">article list</div>
      <div className="article-view">article view</div>
    </div>
  )
}
```

`src/renderer/src/styles/global.css`:
```css
:root {
  --sidebar-width: 220px;
  --list-width: 300px;
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --border-color: #e0e0e0;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --accent: #0060df;
  --font-system: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: var(--font-system); color: var(--text-primary); background: var(--bg-primary); }

.app {
  display: flex;
  height: 100vh;
  -webkit-app-region: drag;
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  -webkit-app-region: no-drag;
}

.article-list {
  width: var(--list-width);
  border-right: 1px solid var(--border-color);
  -webkit-app-region: no-drag;
}

.article-view {
  flex: 1;
  -webkit-app-region: no-drag;
}
```

- [ ] **Step 8: Add scripts to package.json and verify app launches**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "package": "electron-vite build && electron-builder"
  },
  "main": "./out/main/index.js"
}
```

Run: `pnpm dev`
Expected: Electron window opens showing three-pane layout with placeholder text

- [ ] **Step 9: Commit**

```bash
git init
echo "node_modules/\nout/\ndist/\n.DS_Store\n*.db*\n.superpowers/" > .gitignore
git add .
git commit -m "feat: scaffold Electron + React project with electron-vite"
```

---

## Task 2: Database Layer

**Files:**
- Create: `src/main/db/index.ts`

- [ ] **Step 1: Create database module with schema migration**

`src/main/db/index.ts`:
```ts
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { copyFileSync, existsSync } from 'fs'

let db: Database.Database

const SCHEMA_VERSION = 1

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
```

- [ ] **Step 2: Verify database initializes correctly**

Run: `pnpm dev`
Expected: App starts without errors, `feeds.db` created in `~/Library/Application Support/rss-reader/`

- [ ] **Step 3: Commit**

```bash
git add src/main/db/
git commit -m "feat: add SQLite database layer with schema migrations and auto-backup"
```

---

## Task 3: Feed Fetcher Service

**Files:**
- Create: `src/main/services/feed-fetcher.ts`

- [ ] **Step 1: Create feed fetcher with HTTP request, feedparser, and auto-discovery**

`src/main/services/feed-fetcher.ts`:
```ts
import { getDb } from '../db'
import FeedParser from 'feedparser'
import { request } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { parse as parseUrl } from 'url'

export interface FetchResult {
  status: 'success' | 'error'
  articlesCount: number
  responseTime: number
  errorMsg?: string
  feedTitle?: string
  feedSiteUrl?: string
}

export async function fetchFeed(feedId: number, feedUrl: string): Promise<FetchResult> {
  const start = Date.now()
  try {
    const { articles, meta } = await parseFeed(feedUrl)
    const articlesCount = saveArticles(feedId, articles)
    const responseTime = Date.now() - start

    getDb().prepare(
      "UPDATE feeds SET title = ?, site_url = COALESCE(?, site_url), last_fetched_at = datetime('now') WHERE id = ?"
    ).run(meta.title || '', meta.link || '', feedId)

    logFetch(feedId, 'success', null, articlesCount, responseTime)
    return { status: 'success', articlesCount, responseTime, feedTitle: meta.title, feedSiteUrl: meta.link }
  } catch (err: any) {
    const responseTime = Date.now() - start
    const errorMsg = err.message || String(err)
    logFetch(feedId, 'error', errorMsg, 0, responseTime)
    return { status: 'error', articlesCount: 0, responseTime, errorMsg }
  }
}

export async function discoverFeed(url: string): Promise<{ feedUrl: string; title?: string } | null> {
  try {
    const html = await fetchUrlAsString(url)
    const match = html.match(/<link[^>]+type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]+href=["']([^"']+)["'][^>]*>/i)
      || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]*>/i)
    if (match) {
      let feedUrl = match[2] || match[1]
      if (feedUrl.startsWith('/')) {
        const parsed = parseUrl(url)
        feedUrl = `${parsed.protocol}//${parsed.host}${feedUrl}`
      } else if (!feedUrl.startsWith('http')) {
        feedUrl = new URL(feedUrl, url).href
      }
      return { feedUrl }
    }
    return null
  } catch {
    return null
  }
}

function parseFeed(feedUrl: string): Promise<{ articles: FeedParser.Item[]; meta: FeedParser.Meta }> {
  return new Promise((resolve, reject) => {
    const parsed = parseUrl(feedUrl)
    const reqFn = parsed.protocol === 'https:' ? httpsRequest : request
    const req = reqFn({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      headers: { 'User-Agent': 'RSSReader/1.0', 'Accept': 'text/html,application/rss+xml,application/atom+xml,application/xml;q=0.9' }
    }, (res) => {
      const feedparser = new FeedParser({})
      const articles: FeedParser.Item[] = []
      let meta: FeedParser.Meta

      res.pipe(feedparser)

      feedparser.on('error', (err: Error) => reject(err))
      feedparser.on('readable', function () {
        meta = this.meta
        let item
        while ((item = this.read())) {
          articles.push(item)
        }
      })
      feedparser.on('end', () => resolve({ articles, meta }))
    })
    req.on('error', (err: Error) => reject(err))
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.end()
  })
}

function saveArticles(feedId: number, articles: FeedParser.Item[]): number {
  const stmt = getDb().prepare(
    `INSERT OR IGNORE INTO articles (feed_id, title, url, author, content, summary, guid, read, starred, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
  )
  let count = 0
  for (const article of articles) {
    const info = stmt.run(
      feedId,
      article.title || 'Untitled',
      article.link || null,
      article.author || null,
      article.description || article.summary || null,
      article.summary || null,
      article.guid || article.link || article.title,
      article.pubdate || null
    )
    if (info.changes > 0) count++
  }
  return count
}

function logFetch(feedId: number, status: string, errorMsg: string | null, articlesCount: number, responseTime: number): void {
  getDb().prepare(
    "INSERT INTO fetch_logs (feed_id, status, error_msg, articles_count, response_time) VALUES (?, ?, ?, ?, ?)"
  ).run(feedId, status, errorMsg, articlesCount, responseTime)
}

function fetchUrlAsString(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = parseUrl(url)
    const reqFn = parsed.protocol === 'https:' ? httpsRequest : request
    const req = reqFn(url, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.end()
  })
}
```

- [ ] **Step 2: Verify feed fetcher compiles**

Run: `pnpm dev`
Expected: App starts without errors

- [ ] **Step 3: Commit**

```bash
git add src/main/services/feed-fetcher.ts
git commit -m "feat: add feed fetcher with RSS parsing and auto-discovery"
```

---

## Task 4: IPC Handlers — Feeds, Articles, Folders

**Files:**
- Create: `src/main/ipc/feeds.ts`
- Create: `src/main/ipc/articles.ts`
- Create: `src/main/ipc/folders.ts`
- Create: `src/main/ipc/settings.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create feeds IPC handler**

`src/main/ipc/feeds.ts`:
```ts
import { ipcMain, BrowserWindow } from 'electron'
import { getDb } from '../db'
import { fetchFeed, discoverFeed } from '../services/feed-fetcher'

export function registerFeedIpc(): void {
  ipcMain.handle('feeds:add', async (_event, url: string, folderId?: number) => {
    let feedUrl = url
    let discoveredTitle: string | undefined

    // Try auto-discovery if URL doesn't look like a feed
    if (!url.match(/\.(xml|rss|atom)(\?|$)/i) && !url.includes('/feed') && !url.includes('/rss')) {
      const discovered = await discoverFeed(url)
      if (discovered) {
        feedUrl = discovered.feedUrl
        discoveredTitle = discovered.title
      }
    }

    // Fetch the feed to get its title
    const tempResult = await fetchFeed(-1, feedUrl)
    if (tempResult.status === 'error') {
      return { error: tempResult.errorMsg }
    }

    const info = getDb().prepare(
      'INSERT INTO feeds (title, url, site_url, folder_id) VALUES (?, ?, ?, ?)'
    ).run(
      discoveredTitle || tempResult.feedTitle || feedUrl,
      feedUrl,
      tempResult.feedSiteUrl || null,
      folderId || null
    )

    // Now fetch articles with the real feed ID
    await fetchFeed(info.lastInsertRowid as number, feedUrl)
    notifyFeedsUpdated()
    return { id: info.lastInsertRowid }
  })

  ipcMain.handle('feeds:remove', (_event, id: number) => {
    getDb().prepare('DELETE FROM articles WHERE feed_id = ?').run(id)
    getDb().prepare('DELETE FROM fetch_logs WHERE feed_id = ?').run(id)
    getDb().prepare('DELETE FROM feeds WHERE id = ?').run(id)
    notifyFeedsUpdated()
  })

  ipcMain.handle('feeds:update', (_event, id: number, changes: Record<string, unknown>) => {
    const allowed = ['title', 'url', 'folder_id', 'open_in_browser', 'refresh_interval', 'favicon_url']
    const sets: string[] = []
    const values: unknown[] = []
    for (const key of allowed) {
      if (key in changes) {
        sets.push(`${key} = ?`)
        values.push(changes[key])
      }
    }
    if (sets.length === 0) return
    values.push(id)
    getDb().prepare(`UPDATE feeds SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    notifyFeedsUpdated()
  })

  ipcMain.handle('feeds:list', () => {
    return getDb().prepare(`
      SELECT f.*, COUNT(CASE WHEN a.read = 0 THEN 1 END) as unread_count
      FROM feeds f
      LEFT JOIN articles a ON a.feed_id = f.id
      GROUP BY f.id
      ORDER BY f.title
    `).all()
  })

  ipcMain.handle('feeds:refresh', async (_event, id?: number) => {
    if (id) {
      const feed = getDb().prepare('SELECT * FROM feeds WHERE id = ?').get(id) as any
      if (feed) await fetchFeed(feed.id, feed.url)
    } else {
      const feeds = getDb().prepare('SELECT * FROM feeds').all() as any[]
      for (const feed of feeds) {
        await fetchFeed(feed.id, feed.url)
      }
    }
    notifyFeedsUpdated()
    notifyArticlesUpdated()
  })
}

function notifyFeedsUpdated() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('feeds:updated')
  }
}

function notifyArticlesUpdated() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('articles:updated')
  }
}
```

- [ ] **Step 2: Create articles IPC handler**

`src/main/ipc/articles.ts`:
```ts
import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerArticleIpc(): void {
  ipcMain.handle('articles:list', (_event, feedId?: number, options?: { unreadOnly?: boolean; starredOnly?: boolean; limit?: number; offset?: number }) => {
    const conditions: string[] = []
    const params: unknown[] = []

    if (feedId) {
      conditions.push('a.feed_id = ?')
      params.push(feedId)
    }
    if (options?.unreadOnly) {
      conditions.push('a.read = 0')
    }
    if (options?.starredOnly) {
      conditions.push('a.starred = 1')
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = options?.limit || 100
    const offset = options?.offset || 0

    const articles = getDb().prepare(
      `SELECT a.*, f.title as feed_title FROM articles a JOIN feeds f ON f.id = a.feed_id ${where} ORDER BY a.published_at DESC, a.fetched_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset)

    const countResult = getDb().prepare(
      `SELECT COUNT(*) as total FROM articles a ${where}`
    ).get(...params) as { total: number }

    return { articles, total: countResult.total }
  })

  ipcMain.handle('articles:markRead', (_event, id: number) => {
    getDb().prepare('UPDATE articles SET read = 1 WHERE id = ?').run(id)
  })

  ipcMain.handle('articles:markStarred', (_event, id: number, starred: boolean) => {
    getDb().prepare('UPDATE articles SET starred = ? WHERE id = ?').run(starred ? 1 : 0, id)
  })
}
```

- [ ] **Step 3: Create folders IPC handler**

`src/main/ipc/folders.ts`:
```ts
import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerFolderIpc(): void {
  ipcMain.handle('folders:create', (_event, name: string) => {
    const maxOrder = getDb().prepare('SELECT MAX(sort_order) as max FROM folders').get() as { max: number | null }
    const info = getDb().prepare('INSERT INTO folders (name, sort_order) VALUES (?, ?)').run(name, (maxOrder.max ?? -1) + 1)
    return { id: info.lastInsertRowid }
  })

  ipcMain.handle('folders:reorder', (_event, orderedIds: number[]) => {
    const stmt = getDb().prepare('UPDATE folders SET sort_order = ? WHERE id = ?')
    const tx = getDb().transaction((ids: number[]) => {
      for (let i = 0; i < ids.length; i++) {
        stmt.run(i, ids[i])
      }
    })
    tx(orderedIds)
  })
}
```

- [ ] **Step 4: Create settings IPC handler**

`src/main/ipc/settings.ts`:
```ts
import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (_event, key: string) => {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  })

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
  })
}
```

- [ ] **Step 5: Register all IPC handlers in main entry**

Update `src/main/index.ts` — add imports and calls before `createMainWindow()`:

```ts
import { initDatabase } from './db'
import { registerFeedIpc } from './ipc/feeds'
import { registerArticleIpc } from './ipc/articles'
import { registerFolderIpc } from './ipc/folders'
import { registerSettingsIpc } from './ipc/settings'
// ... inside app.whenReady():
  initDatabase()
  registerFeedIpc()
  registerArticleIpc()
  registerFolderIpc()
  registerSettingsIpc()
  createMainWindow()
```

- [ ] **Step 6: Verify app starts and IPC is registered**

Run: `pnpm dev`
Expected: App starts, no errors in console

- [ ] **Step 7: Commit**

```bash
git add src/main/
git commit -m "feat: add IPC handlers for feeds, articles, folders, and settings"
```

---

## Task 5: Refresh Scheduler

**Files:**
- Create: `src/main/services/scheduler.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create scheduler service**

`src/main/services/scheduler.ts`:
```ts
import { getDb } from '../db'
import { fetchFeed } from './feed-fetcher'
import { BrowserWindow } from 'electron'

interface ScheduledFeed {
  id: number
  url: string
  refresh_interval: number
}

const timers = new Map<number, NodeJS.Timeout>()
let running = false

export function startScheduler(): void {
  if (running) return
  running = true
  scheduleAllFeeds()
}

export function stopScheduler(): void {
  running = false
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }
  timers.clear()
}

function scheduleAllFeeds(): void {
  const feeds = getDb().prepare('SELECT id, url, refresh_interval FROM feeds').all() as ScheduledFeed[]
  for (const feed of feeds) {
    scheduleFeed(feed)
  }
}

function scheduleFeed(feed: ScheduledFeed): void {
  if (!running) return
  const intervalMs = (feed.refresh_interval || 30) * 60 * 1000
  const timer = setTimeout(async () => {
    const result = await fetchFeed(feed.id, feed.url)
    notifyWindows()
    // Re-schedule
    if (running) {
      const updated = getDb().prepare('SELECT id, url, refresh_interval FROM feeds WHERE id = ?').get(feed.id) as ScheduledFeed | undefined
      if (updated) scheduleFeed(updated)
    }
  }, intervalMs)
  timers.set(feed.id, timer)
}

export function rescheduleFeed(feedId: number): void {
  const existing = timers.get(feedId)
  if (existing) clearTimeout(existing)
  const feed = getDb().prepare('SELECT id, url, refresh_interval FROM feeds WHERE id = ?').get(feedId) as ScheduledFeed | undefined
  if (feed && running) scheduleFeed(feed)
}

function notifyWindows(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('feeds:updated')
    win.webContents.send('articles:updated')
  }
}
```

- [ ] **Step 2: Integrate scheduler into main entry**

Add to `src/main/index.ts`:
```ts
import { startScheduler, stopScheduler } from './services/scheduler'
// After createMainWindow():
  startScheduler()
// Inside app.on('window-all-closed') before app.quit():
  stopScheduler()
```

- [ ] **Step 3: Verify scheduler starts with app**

Run: `pnpm dev`
Expected: App starts, no errors

- [ ] **Step 4: Commit**

```bash
git add src/main/services/scheduler.ts src/main/index.ts
git commit -m "feat: add refresh scheduler with per-feed intervals"
```

---

## Task 6: OPML Import/Export

**Files:**
- Create: `src/main/services/opml.ts`
- Create: `src/main/ipc/opml.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create OPML service**

`src/main/services/opml.ts`:
```ts
import { getDb } from '../db'
import { fetchFeed } from './feed-fetcher'

export async function importOpml(xmlString: string): Promise<{ imported: number; failed: number }> {
  let imported = 0
  let failed = 0
  const parser = new DOMParser()
  // Simple XML parsing for OPML — no DOM in main process, use regex-based approach
  const outlines = xmlString.match(/<outline[^>]*>/g) || []

  for (const outline of outlines) {
    const xmlUrl = outline.match(/xmlUrl=["']([^"']+)["']/)?.[1]
    if (!xmlUrl) continue

    const title = outline.match(/title=["']([^"']+)["']/)?.[1]
      || outline.match(/text=["']([^"']+)["']/)?.[1]
      || xmlUrl

    // Find or create folder from category attribute
    const category = outline.match(/category=["']([^"']+)["']/)?.[1]

    try {
      const existing = getDb().prepare('SELECT id FROM feeds WHERE url = ?').get(xmlUrl)
      if (existing) continue

      let folderId: number | null = null
      if (category) {
        const folder = getDb().prepare('SELECT id FROM folders WHERE name = ?').get(category) as { id: number } | undefined
        if (folder) {
          folderId = folder.id
        } else {
          const info = getDb().prepare('INSERT INTO folders (name) VALUES (?)').run(category)
          folderId = info.lastInsertRowid as number
        }
      }

      const info = getDb().prepare('INSERT INTO feeds (title, url, folder_id) VALUES (?, ?, ?)').run(title, xmlUrl, folderId)
      await fetchFeed(info.lastInsertRowid as number, xmlUrl)
      imported++
    } catch {
      failed++
    }
  }
  return { imported, failed }
}

export function exportOpml(): string {
  const feeds = getDb().prepare(`
    SELECT f.*, fo.name as folder_name FROM feeds f
    LEFT JOIN folders fo ON fo.id = f.folder_id
    ORDER BY fo.name, f.title
  `).all() as any[]

  const outlines = feeds.map(feed => {
    const attrs = [`type="rss"`, `text="${escapeXml(feed.title)}"`, `title="${escapeXml(feed.title)}"`, `xmlUrl="${escapeXml(feed.url)}"`]
    if (feed.site_url) attrs.push(`htmlUrl="${escapeXml(feed.site_url)}"`)
    return `    <outline ${attrs.join(' ')} />`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>RSS Reader Subscriptions</title>
  </head>
  <body>
${outlines}
  </body>
</opml>`
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
```

- [ ] **Step 2: Create OPML IPC handler**

`src/main/ipc/opml.ts`:
```ts
import { ipcMain, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { importOpml, exportOpml } from '../services/opml'

export function registerOpmlIpc(): void {
  ipcMain.handle('opml:import', async (_event, filePath?: string) => {
    const path = filePath || (await dialog.showOpenDialog({
      filters: [{ name: 'OPML', extensions: ['opml', 'xml'] }],
      properties: ['openFile']
    })).filePaths[0]
    if (!path) return { imported: 0, failed: 0 }

    const xml = await readFile(path, 'utf-8')
    return importOpml(xml)
  })

  ipcMain.handle('opml:export', async () => {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: 'subscriptions.opml',
      filters: [{ name: 'OPML', extensions: ['opml'] }]
    })
    if (!filePath) return false

    const xml = exportOpml()
    await writeFile(filePath, xml, 'utf-8')
    return true
  })
}
```

- [ ] **Step 3: Register OPML IPC in main entry**

Add to `src/main/index.ts`:
```ts
import { registerOpmlIpc } from './ipc/opml'
// With the other register calls:
  registerOpmlIpc()
```

- [ ] **Step 4: Commit**

```bash
git add src/main/services/opml.ts src/main/ipc/opml.ts src/main/index.ts
git commit -m "feat: add OPML import/export with file dialog"
```

---

## Task 7: Stats IPC + Window

**Files:**
- Create: `src/main/ipc/stats.ts`
- Create: `src/main/windows/stats.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create stats IPC handler**

`src/main/ipc/stats.ts`:
```ts
import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerStatsIpc(): void {
  ipcMain.handle('stats:getMonthly', (_event, feedId?: number, months?: number) => {
    const monthCount = months || 12
    let query = `
      SELECT
        strftime('%Y-%m', fetched_at) as month,
        COUNT(*) as total_fetches,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        SUM(articles_count) as articles_count,
        AVG(response_time) as avg_response_time
      FROM fetch_logs
      WHERE fetched_at >= datetime('now', ? || ' months')
    `
    const params: unknown[] = [`-${monthCount}`]
    if (feedId) {
      query += ' AND feed_id = ?'
      params.push(feedId)
    }
    query += ' GROUP BY strftime("%Y-%m", fetched_at) ORDER BY month'

    return getDb().prepare(query).all(...params)
  })

  ipcMain.handle('stats:getFeedHealth', () => {
    const feeds = getDb().prepare(`
      SELECT
        f.id, f.title, f.url,
        COUNT(fl.id) as total_fetches,
        SUM(CASE WHEN fl.status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN fl.status = 'error' THEN 1 ELSE 0 END) as error_count,
        AVG(fl.response_time) as avg_response_time,
        fl_recent.error_msg as last_error,
        COALESCE(a_count.article_count, 0) as articles_last_30_days,
        CASE
          WHEN fl_consecutive.fail_count >= 3 THEN 'failed'
          WHEN COALESCE(a_count.article_count, 0) = 0 THEN 'inactive'
          ELSE 'healthy'
        END as health_status
      FROM feeds f
      LEFT JOIN fetch_logs fl ON fl.feed_id = f.id
      LEFT JOIN (
        SELECT feed_id, error_msg FROM fetch_logs
        WHERE status = 'error' ORDER BY fetched_at DESC LIMIT 1
      ) fl_recent ON fl_recent.feed_id = f.id
      LEFT JOIN (
        SELECT feed_id, COUNT(*) as fail_count FROM fetch_logs
        WHERE status = 'error' AND fetched_at >= datetime('now', '-7 days')
        GROUP BY feed_id
      ) fl_consecutive ON fl_consecutive.feed_id = f.id
      LEFT JOIN (
        SELECT feed_id, COUNT(*) as article_count FROM articles
        WHERE fetched_at >= datetime('now', '-30 days')
        GROUP BY feed_id
      ) a_count ON a_count.feed_id = f.id
      GROUP BY f.id
      ORDER BY f.title
    `).all()

    const overview = getDb().prepare(`
      SELECT
        (SELECT COUNT(*) FROM feeds) as total_feeds,
        (SELECT COUNT(*) FROM articles WHERE fetched_at >= datetime('now', '-30 days')) as articles_this_month,
        (SELECT COUNT(DISTINCT feed_id FROM articles WHERE fetched_at >= datetime('now', '-30 days')) as active_feeds),
        (SELECT COUNT(*) FROM feeds WHERE id IN (
          SELECT feed_id FROM fetch_logs WHERE status = 'error' AND fetched_at >= datetime('now', '-7 days')
          GROUP BY feed_id HAVING COUNT(*) >= 3
        )) as failed_feeds
    `).get()

    return { feeds, overview }
  })
}
```

- [ ] **Step 2: Create stats window**

`src/main/windows/stats.ts`:
```ts
import { BrowserWindow, join } from 'electron'
import { join as pathJoin } from 'path'

export function createStatsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Subscription Statistics',
    parent: undefined,
    webPreferences: {
      preload: pathJoin(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.loadFile(pathJoin(__dirname, '../renderer/index.html') + '#stats')
  return win
}
```

- [ ] **Step 3: Register stats IPC in main entry**

Add to `src/main/index.ts`:
```ts
import { registerStatsIpc } from './ipc/stats'
// With other register calls:
  registerStatsIpc()
```

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/stats.ts src/main/windows/stats.ts src/main/index.ts
git commit -m "feat: add stats IPC handlers and stats window"
```

---

## Task 8: Sidebar Component

**Files:**
- Create: `src/renderer/src/components/Sidebar/Sidebar.tsx`
- Create: `src/renderer/src/components/Sidebar/SidebarItem.tsx`
- Create: `src/renderer/src/components/Sidebar/AddFeedDialog.tsx`
- Create: `src/renderer/src/styles/sidebar.css`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Create Sidebar component**

`src/renderer/src/components/Sidebar/Sidebar.tsx`:
```tsx
import { useState, useEffect, useCallback } from 'react'
import SidebarItem from './SidebarItem'
import AddFeedDialog from './AddFeedDialog'
import '../styles/sidebar.css'

interface Feed {
  id: number
  title: string
  url: string
  folder_id: number | null
  unread_count: number
  open_in_browser: boolean
}

interface Folder {
  id: number
  name: string
  sort_order: number
}

interface Props {
  selectedFeedId: number | null
  selectedFilter: string | null
  onSelectFeed: (feedId: number) => void
  onSelectFilter: (filter: string) => void
}

export default function Sidebar({ selectedFeedId, selectedFilter, onSelectFeed, onSelectFilter }: Props) {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [starredCount, setStarredCount] = useState(0)

  const loadFeeds = useCallback(async () => {
    const feeds = await window.api.feeds.list()
    setFeeds(feeds)
    const total = feeds.reduce((sum: number, f: Feed) => sum + f.unread_count, 0)
    setUnreadCount(total)
  }, [])

  useEffect(() => {
    loadFeeds()
    return window.api.onFeedsUpdated(loadFeeds)
  }, [loadFeeds])

  const handleAddFeed = async (url: string) => {
    await window.api.feeds.add(url)
    setShowAddFeed(false)
    loadFeeds()
  }

  const handleDelete = async (feedId: number) => {
    await window.api.feeds.remove(feedId)
    loadFeeds()
  }

  const groupedFeeds = feeds.reduce((acc: Record<number, Feed[]>, feed: Feed) => {
    const key = feed.folder_id || 0
    acc[key] = acc[key] || []
    acc[key].push(feed)
    return acc
  }, {})

  const ungrouped = groupedFeeds[0] || []

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <SidebarItem
          label="All Unread"
          count={unreadCount}
          selected={selectedFilter === 'unread'}
          onClick={() => onSelectFilter('unread')}
        />
        <SidebarItem
          label="Today"
          count={todayCount}
          selected={selectedFilter === 'today'}
          onClick={() => onSelectFilter('today')}
        />
        <SidebarItem
          label="Starred"
          count={starredCount}
          selected={selectedFilter === 'starred'}
          onClick={() => onSelectFilter('starred')}
        />
      </div>

      <div className="sidebar-section sidebar-feeds">
        {folders.map(folder => (
          <div key={folder.id} className="sidebar-folder">
            <div className="sidebar-folder-header">{folder.name}</div>
            {(groupedFeeds[folder.id] || []).map(feed => (
              <SidebarItem
                key={feed.id}
                label={feed.title}
                count={feed.unread_count}
                selected={selectedFeedId === feed.id && !selectedFilter}
                onClick={() => onSelectFeed(feed.id)}
                onDelete={() => handleDelete(feed.id)}
                onRefresh={() => window.api.feeds.refresh(feed.id)}
              />
            ))}
          </div>
        ))}
        {ungrouped.map(feed => (
          <SidebarItem
            key={feed.id}
            label={feed.title}
            count={feed.unread_count}
            selected={selectedFeedId === feed.id && !selectedFilter}
            onClick={() => onSelectFeed(feed.id)}
            onDelete={() => handleDelete(feed.id)}
            onRefresh={() => window.api.feeds.refresh(feed.id)}
          />
        ))}
      </div>

      <div className="sidebar-toolbar">
        <button onClick={() => setShowAddFeed(true)} title="Add Feed">+</button>
        <button onClick={() => window.api.feeds.refresh()} title="Refresh All">↻</button>
        <button onClick={() => window.api.opml.export()} title="Export OPML">↑</button>
      </div>

      {showAddFeed && (
        <AddFeedDialog onAdd={handleAddFeed} onClose={() => setShowAddFeed(false)} />
      )}
    </aside>
  )
}
```

- [ ] **Step 2: Create SidebarItem component**

`src/renderer/src/components/Sidebar/SidebarItem.tsx`:
```tsx
interface Props {
  label: string
  count?: number
  selected: boolean
  onClick: () => void
  onDelete?: () => void
  onRefresh?: () => void
}

export default function SidebarItem({ label, count, selected, onClick, onDelete, onRefresh }: Props) {
  return (
    <div
      className={`sidebar-item ${selected ? 'selected' : ''}`}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        // Future: native context menu via IPC
      }}
    >
      <span className="sidebar-item-label">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="sidebar-item-count">{count}</span>
      )}
      {onRefresh && (
        <button className="sidebar-item-action" onClick={(e) => { e.stopPropagation(); onRefresh() }}>↻</button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create AddFeedDialog component**

`src/renderer/src/components/Sidebar/AddFeedDialog.tsx`:
```tsx
import { useState } from 'react'

interface Props {
  onAdd: (url: string) => void
  onClose: () => void
}

export default function AddFeedDialog({ onAdd, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')
    try {
      await onAdd(url.trim())
    } catch (err: any) {
      setError(err.message || 'Failed to add feed')
      setLoading(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>Add Feed</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="url"
            placeholder="Enter website or feed URL"
            value={url}
            onChange={e => setUrl(e.target.value)}
            autoFocus
            className="dialog-input"
          />
          {error && <div className="dialog-error">{error}</div>}
          <div className="dialog-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading || !url.trim()} className="btn-primary">
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create sidebar CSS**

`src/renderer/src/styles/sidebar.css`:
```css
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  user-select: none;
}

.sidebar-section {
  padding: 4px 6px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-feeds {
  flex: 1;
  overflow-y: auto;
  border-bottom: none;
}

.sidebar-folder-header {
  padding: 6px 10px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  gap: 4px;
}

.sidebar-item:hover { background: rgba(0,0,0,0.05); }
.sidebar-item.selected { background: var(--accent); color: white; }
.sidebar-item.selected .sidebar-item-count { color: rgba(255,255,255,0.8); }

.sidebar-item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.sidebar-item-count {
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 16px;
  text-align: right;
}

.sidebar-item-action {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  opacity: 0;
  color: var(--text-secondary);
  padding: 2px;
}
.sidebar-item:hover .sidebar-item-action { opacity: 1; }

.sidebar-toolbar {
  display: flex;
  gap: 2px;
  padding: 6px;
  border-top: 1px solid var(--border-color);
}

.sidebar-toolbar button {
  flex: 1;
  border: none;
  background: none;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
}
.sidebar-toolbar button:hover { background: rgba(0,0,0,0.08); }

/* Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  background: white;
  border-radius: 8px;
  padding: 20px;
  width: 380px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}

.dialog h3 { margin-bottom: 12px; font-size: 15px; }

.dialog-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}
.dialog-input:focus { border-color: var(--accent); }

.dialog-error { color: #c00; font-size: 12px; margin-top: 6px; }

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

.btn-primary, .btn-secondary {
  padding: 6px 14px;
  border-radius: 4px;
  border: none;
  font-size: 13px;
  cursor: pointer;
}
.btn-primary { background: var(--accent); color: white; }
.btn-primary:disabled { opacity: 0.5; }
.btn-secondary { background: var(--bg-secondary); }
```

- [ ] **Step 5: Wire Sidebar into App.tsx**

Replace `src/renderer/src/App.tsx`:
```tsx
import { useState } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import './styles/global.css'

export default function App() {
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<string | null>('unread')

  return (
    <div className="app">
      <Sidebar
        selectedFeedId={selectedFeedId}
        selectedFilter={selectedFilter}
        onSelectFeed={(id) => { setSelectedFeedId(id); setSelectedFilter(null) }}
        onSelectFilter={(filter) => { setSelectedFilter(filter); setSelectedFeedId(null) }}
      />
      <div className="article-list">article list</div>
      <div className="article-view">article view</div>
    </div>
  )
}
```

- [ ] **Step 6: Verify sidebar renders with placeholder data**

Run: `pnpm dev`
Expected: App shows sidebar with smart feeds and empty feed list, "+" button opens add feed dialog

- [ ] **Step 7: Commit**

```bash
git add src/renderer/
git commit -m "feat: add Sidebar with feed list, add-feed dialog, and smart feeds"
```

---

## Task 9: Article List Component

**Files:**
- Create: `src/renderer/src/components/ArticleList/ArticleList.tsx`
- Create: `src/renderer/src/components/ArticleList/ArticleRow.tsx`
- Create: `src/renderer/src/hooks/useArticles.ts`
- Create: `src/renderer/src/styles/article-list.css`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Create useArticles hook**

`src/renderer/src/hooks/useArticles.ts`:
```ts
import { useState, useEffect, useCallback } from 'react'

export interface Article {
  id: number
  feed_id: number
  title: string
  url: string | null
  author: string | null
  summary: string | null
  read: boolean
  starred: boolean
  published_at: string | null
  fetched_at: string
  feed_title: string
}

interface Props {
  feedId: number | null
  filter: string | null
}

export function useArticles({ feedId, filter }: Props) {
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const loadArticles = useCallback(async () => {
    const options: Record<string, unknown> = { limit: 200 }
    let fid = feedId

    if (filter === 'unread') options.unreadOnly = true
    if (filter === 'starred') options.starredOnly = true

    const result = await window.api.articles.list(fid || undefined, options)
    setArticles(result.articles)
  }, [feedId, filter])

  useEffect(() => {
    loadArticles()
    setSelectedId(null)
    return window.api.onArticlesUpdated(loadArticles)
  }, [loadArticles])

  const markRead = useCallback(async (id: number) => {
    await window.api.articles.markRead(id)
    setArticles(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
  }, [])

  const markStarred = useCallback(async (id: number, starred: boolean) => {
    await window.api.articles.markStarred(id, starred)
    setArticles(prev => prev.map(a => a.id === id ? { ...a, starred } : a))
  }, [])

  return { articles, selectedId, setSelectedId, markRead, markStarred }
}
```

- [ ] **Step 2: Create ArticleRow component**

`src/renderer/src/components/ArticleList/ArticleRow.tsx`:
```tsx
import { Article } from '../../hooks/useArticles'

interface Props {
  article: Article
  selected: boolean
  onClick: () => void
}

export default function ArticleRow({ article, selected, onClick }: Props) {
  const timeStr = article.published_at
    ? formatRelativeTime(new Date(article.published_at))
    : ''

  return (
    <div
      className={`article-row ${selected ? 'selected' : ''} ${article.read ? 'read' : 'unread'}`}
      onClick={onClick}
    >
      <div className="article-row-title">{article.title}</div>
      <div className="article-row-meta">
        <span className="article-row-feed">{article.feed_title}</span>
        <span className="article-row-time">{timeStr}</span>
      </div>
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d`
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
```

- [ ] **Step 3: Create ArticleList with virtual scroll**

`src/renderer/src/components/ArticleList/ArticleList.tsx`:
```tsx
import { Virtuoso } from 'react-virtuoso'
import ArticleRow from './ArticleRow'
import { Article } from '../../hooks/useArticles'
import '../styles/article-list.css'

interface Props {
  articles: Article[]
  selectedId: number | null
  onSelect: (id: number) => void
}

export default function ArticleList({ articles, selectedId, onSelect }: Props) {
  return (
    <div className="article-list">
      <Virtuoso
        data={articles}
        itemContent={(_, article) => (
          <ArticleRow
            article={article}
            selected={article.id === selectedId}
            onClick={() => onSelect(article.id)}
          />
        )}
      />
    </div>
  )
}
```

- [ ] **Step 4: Create article list CSS**

`src/renderer/src/styles/article-list.css`:
```css
.article-list {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.article-row {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.1s;
}

.article-row:hover { background: rgba(0,0,0,0.03); }
.article-row.selected { background: #e8f0fe; }

.article-row.unread .article-row-title { font-weight: 600; }
.article-row.read { opacity: 0.6; }

.article-row-title {
  font-size: 13px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-row-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-secondary);
}
```

- [ ] **Step 5: Wire ArticleList into App.tsx**

Update `src/renderer/src/App.tsx`:
```tsx
import { useState } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import ArticleList from './components/ArticleList/ArticleList'
import { useArticles } from './hooks/useArticles'
import './styles/global.css'

export default function App() {
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<string | null>('unread')
  const { articles, selectedId, setSelectedId, markRead, markStarred } = useArticles({
    feedId: selectedFeedId,
    filter: selectedFilter
  })

  return (
    <div className="app">
      <Sidebar
        selectedFeedId={selectedFeedId}
        selectedFilter={selectedFilter}
        onSelectFeed={(id) => { setSelectedFeedId(id); setSelectedFilter(null) }}
        onSelectFilter={(filter) => { setSelectedFilter(filter); setSelectedFeedId(null) }}
      />
      <ArticleList
        articles={articles}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <div className="article-view">article view</div>
    </div>
  )
}
```

- [ ] **Step 6: Verify article list renders**

Run: `pnpm dev`
Expected: Three-pane layout, article list pane shows (empty until feeds are added)

- [ ] **Step 7: Commit**

```bash
git add src/renderer/
git commit -m "feat: add ArticleList with virtual scroll and useArticles hook"
```

---

## Task 10: Article View Component

**Files:**
- Create: `src/renderer/src/components/ArticleView/ArticleView.tsx`
- Create: `src/renderer/src/components/ArticleView/ArticleHeader.tsx`
- Create: `src/renderer/src/styles/article-view.css`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Create ArticleHeader component**

`src/renderer/src/components/ArticleView/ArticleHeader.tsx`:
```tsx
import { Article } from '../../hooks/useArticles'

interface Props {
  article: Article
  onToggleStar: () => void
  onOpenExternal: () => void
}

export default function ArticleHeader({ article, onToggleStar, onOpenExternal }: Props) {
  return (
    <div className="article-header">
      <h1 className="article-title">{article.title}</h1>
      <div className="article-meta">
        <span className="article-meta-feed">{article.feed_title}</span>
        {article.author && <span>by {article.author}</span>}
        <span className="article-meta-time">
          {article.published_at ? new Date(article.published_at).toLocaleString() : ''}
        </span>
        <div className="article-actions">
          <button onClick={onToggleStar} title="Toggle star">
            {article.starred ? '★' : '☆'}
          </button>
          <button onClick={onOpenExternal} title="Open in browser">↗</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ArticleView component**

`src/renderer/src/components/ArticleView/ArticleView.tsx`:
```tsx
import ArticleHeader from './ArticleHeader'
import { Article } from '../../hooks/useArticles'
import '../styles/article-view.css'

interface Props {
  article: Article | null
  onToggleStar: (id: number, starred: boolean) => void
  onMarkRead: (id: number) => void
  feeds: { id: number; open_in_browser: boolean }[]
}

export default function ArticleView({ article, onToggleStar, onMarkRead, feeds }: Props) {
  if (!article) {
    return <div className="article-view empty"><p>Select an article to read</p></div>
  }

  const feed = feeds.find(f => f.id === article.feed_id)
  const openInBrowser = feed?.open_in_browser

  if (openInBrowser && article.url) {
    window.open(article.url, '_blank')
    return <div className="article-view empty"><p>Opened in browser</p></div>
  }

  return (
    <div className="article-view">
      <ArticleHeader
        article={article}
        onToggleStar={() => onToggleStar(article.id, !article.starred)}
        onOpenExternal={() => { if (article.url) window.open(article.url, '_blank') }}
      />
      <div
        className="article-content"
        dangerouslySetInnerHTML={{ __html: article.summary || '' }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create article view CSS**

`src/renderer/src/styles/article-view.css`:
```css
.article-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: white;
}

.article-view.empty {
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.article-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.article-title {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 6px;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-secondary);
}

.article-meta-feed { font-weight: 500; }

.article-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.article-actions button {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
  color: var(--text-secondary);
}
.article-actions button:hover { background: var(--bg-secondary); }

.article-content {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  line-height: 1.7;
  font-size: 14px;
}

.article-content img { max-width: 100%; height: auto; }
.article-content a { color: var(--accent); }
.article-content pre { overflow-x: auto; padding: 10px; background: var(--bg-secondary); border-radius: 4px; }
```

- [ ] **Step 4: Create useFeeds hook**

`src/renderer/src/hooks/useFeeds.ts`:
```ts
import { useState, useEffect, useCallback } from 'react'

export interface Feed {
  id: number
  title: string
  url: string
  folder_id: number | null
  unread_count: number
  open_in_browser: boolean
  refresh_interval: number
}

export function useFeeds() {
  const [feeds, setFeeds] = useState<Feed[]>([])

  const loadFeeds = useCallback(async () => {
    const result = await window.api.feeds.list()
    setFeeds(result)
  }, [])

  useEffect(() => {
    loadFeeds()
    return window.api.onFeedsUpdated(loadFeeds)
  }, [loadFeeds])

  return { feeds, reload: loadFeeds }
}
```

- [ ] **Step 5: Wire ArticleView into App.tsx**

Update `src/renderer/src/App.tsx`:
```tsx
import { useState } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import ArticleList from './components/ArticleList/ArticleList'
import ArticleView from './components/ArticleView/ArticleView'
import { useArticles } from './hooks/useArticles'
import { useFeeds } from './hooks/useFeeds'
import './styles/global.css'

export default function App() {
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<string | null>('unread')
  const { feeds } = useFeeds()
  const { articles, selectedId, setSelectedId, markRead, markStarred } = useArticles({
    feedId: selectedFeedId,
    filter: selectedFilter
  })
  const selectedArticle = articles.find(a => a.id === selectedId) || null

  return (
    <div className="app">
      <Sidebar
        selectedFeedId={selectedFeedId}
        selectedFilter={selectedFilter}
        onSelectFeed={(id) => { setSelectedFeedId(id); setSelectedFilter(null) }}
        onSelectFilter={(filter) => { setSelectedFilter(filter); setSelectedFeedId(null) }}
      />
      <ArticleList
        articles={articles}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <ArticleView
        article={selectedArticle}
        onToggleStar={markStarred}
        onMarkRead={markRead}
        feeds={feeds}
      />
    </div>
  )
}
```

- [ ] **Step 6: Verify article view renders**

Run: `pnpm dev`
Expected: Three-pane layout fully wired. Add a feed, click articles to view content.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/
git commit -m "feat: add ArticleView with HTML rendering, star toggle, and open-in-browser"
```

---

## Task 11: Keyboard Shortcuts

**Files:**
- Create: `src/renderer/src/hooks/useShortcuts.ts`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Create useShortcuts hook**

`src/renderer/src/hooks/useShortcuts.ts`:
```ts
import { useEffect } from 'react'
import { Article } from './useArticles'

interface Props {
  articles: Article[]
  selectedId: number | null
  onSelectArticle: (id: number) => void
  onMarkRead: (id: number) => void
  onToggleStar: (id: number, starred: boolean) => void
  selectedArticle: Article | null
}

export function useShortcuts({ articles, selectedId, onSelectArticle, onMarkRead, onToggleStar, selectedArticle }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const currentIndex = articles.findIndex(a => a.id === selectedId)

      switch (e.key) {
        case 'j': {
          e.preventDefault()
          const next = currentIndex < articles.length - 1 ? currentIndex + 1 : currentIndex
          if (articles[next]) {
            onSelectArticle(articles[next].id)
            onMarkRead(articles[next].id)
          }
          break
        }
        case 'k': {
          e.preventDefault()
          const prev = currentIndex > 0 ? currentIndex - 1 : 0
          if (articles[prev]) onSelectArticle(articles[prev].id)
          break
        }
        case 'r': {
          e.preventDefault()
          if (selectedArticle && !selectedArticle.read) onMarkRead(selectedArticle.id)
          break
        }
        case 's': {
          e.preventDefault()
          if (selectedArticle) onToggleStar(selectedArticle.id, !selectedArticle.starred)
          break
        }
        case 'u': {
          e.preventDefault()
          // Toggle unread — would need a separate IPC, skip for now
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [articles, selectedId, selectedArticle, onSelectArticle, onMarkRead, onToggleStar])
}
```

- [ ] **Step 2: Wire shortcuts into App.tsx**

Add to `src/renderer/src/App.tsx` inside the component, after existing hooks:
```tsx
import { useShortcuts } from './hooks/useShortcuts'
// ... inside App():
  useShortcuts({
    articles,
    selectedId,
    onSelectArticle: setSelectedId,
    onMarkRead: markRead,
    onToggleStar: markStarred,
    selectedArticle
  })
```

- [ ] **Step 3: Add Cmd+ shortcuts via Electron menu (in main index.ts)**

Add to `src/main/index.ts` after `createMainWindow()`:
```ts
import { Menu } from 'electron'
// ... after window creation:
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Feeds',
      submenu: [
        { label: 'Add Feed', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('menu:addFeed') },
        { label: 'Refresh Current', accelerator: 'CmdOrCtrl+R', click: () => win.webContents.send('menu:refreshCurrent') },
        { label: 'Refresh All', accelerator: 'CmdOrCtrl+Shift+R', click: () => win.webContents.send('menu:refreshAll') },
        { type: 'separator' },
        { label: 'Import OPML', click: () => ipcMain.emit('opml:import') },
        { label: 'Export OPML', click: () => ipcMain.emit('opml:export') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
```

- [ ] **Step 4: Verify keyboard navigation works**

Run: `pnpm dev`
Expected: `j`/`k` navigate articles, `s` toggles star, `r` marks read

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/hooks/useShortcuts.ts src/renderer/src/App.tsx src/main/index.ts
git commit -m "feat: add keyboard shortcuts (j/k/r/s) and application menu"
```

---

## Task 12: Stats Window UI

**Files:**
- Create: `src/renderer-stats/index.html`
- Create: `src/renderer-stats/src/main.tsx`
- Create: `src/renderer-stats/src/App.tsx`
- Create: `src/renderer-stats/src/components/OverviewCards.tsx`
- Create: `src/renderer-stats/src/components/MonthlyChart.tsx`
- Create: `src/renderer-stats/src/components/HealthTable.tsx`
- Create: `src/renderer-stats/src/components/AnomalyFilter.tsx`
- Create: `src/renderer-stats/src/hooks/useStats.ts`
- Create: `src/renderer-stats/src/styles/stats.css`

- [ ] **Step 1: Create stats window HTML + React entry**

`src/renderer-stats/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>Subscription Statistics</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./src/main.tsx"></script>
</body>
</html>
```

`src/renderer-stats/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/stats.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
```

- [ ] **Step 2: Create useStats hook**

`src/renderer-stats/src/hooks/useStats.ts`:
```ts
import { useState, useEffect } from 'react'

export interface MonthlyData {
  month: string
  total_fetches: number
  success_count: number
  error_count: number
  articles_count: number
  avg_response_time: number
}

export interface FeedHealth {
  id: number
  title: string
  url: string
  total_fetches: number
  success_count: number
  error_count: number
  avg_response_time: number
  last_error: string | null
  articles_last_30_days: number
  health_status: 'healthy' | 'failed' | 'inactive'
}

export interface Overview {
  total_feeds: number
  articles_this_month: number
  active_feeds: number
  failed_feeds: number
}

export function useStats() {
  const [monthly, setMonthly] = useState<MonthlyData[]>([])
  const [health, setHealth] = useState<FeedHealth[]>([])
  const [overview, setOverview] = useState<Overview>({ total_feeds: 0, articles_this_month: 0, active_feeds: 0, failed_feeds: 0 })

  useEffect(() => {
    async function load() {
      const [m, h] = await Promise.all([
        window.api.stats.getMonthly(undefined, 12),
        window.api.stats.getFeedHealth()
      ])
      setMonthly(m)
      setHealth(h.feeds)
      setOverview(h.overview)
    }
    load()
  }, [])

  return { monthly, health, overview }
}
```

- [ ] **Step 3: Create OverviewCards component**

`src/renderer-stats/src/components/OverviewCards.tsx`:
```tsx
import { Overview } from '../hooks/useStats'

interface Props {
  overview: Overview
}

export default function OverviewCards({ overview }: Props) {
  const cards = [
    { label: 'Total Feeds', value: overview.total_feeds },
    { label: 'Articles This Month', value: overview.articles_this_month },
    { label: 'Active Feeds', value: overview.active_feeds },
    { label: 'Failed Feeds', value: overview.failed_feeds }
  ]

  return (
    <div className="overview-cards">
      {cards.map(card => (
        <div key={card.label} className="overview-card">
          <div className="overview-card-value">{card.value}</div>
          <div className="overview-card-label">{card.label}</div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create MonthlyChart component (text-based bars, no chart library)**

`src/renderer-stats/src/components/MonthlyChart.tsx`:
```tsx
import { MonthlyData } from '../hooks/useStats'

interface Props {
  data: MonthlyData[]
}

export default function MonthlyChart({ data }: Props) {
  const maxArticles = Math.max(...data.map(d => d.articles_count), 1)

  return (
    <div className="monthly-chart">
      <h3>Monthly Articles</h3>
      <div className="chart-bars">
        {data.map(d => (
          <div key={d.month} className="chart-bar-group">
            <div className="chart-bar" style={{ height: `${(d.articles_count / maxArticles) * 100}%` }} />
            <div className="chart-bar-label">{d.month.slice(5)}</div>
            <div className="chart-bar-value">{d.articles_count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create HealthTable component**

`src/renderer-stats/src/components/HealthTable.tsx`:
```tsx
import { FeedHealth } from '../hooks/useStats'

interface Props {
  feeds: FeedHealth[]
}

export default function HealthTable({ feeds }: Props) {
  return (
    <div className="health-table">
      <h3>Feed Health</h3>
      <table>
        <thead>
          <tr>
            <th>Feed</th>
            <th>Success Rate</th>
            <th>Avg Response</th>
            <th>Articles (30d)</th>
            <th>Status</th>
            <th>Last Error</th>
          </tr>
        </thead>
        <tbody>
          {feeds.map(feed => (
            <tr key={feed.id} className={`status-${feed.health_status}`}>
              <td>{feed.title}</td>
              <td>{feed.total_fetches > 0 ? Math.round(feed.success_count / feed.total_fetches * 100) : 0}%</td>
              <td>{Math.round(feed.avg_response_time || 0)}ms</td>
              <td>{feed.articles_last_30_days}</td>
              <td><span className={`badge badge-${feed.health_status}`}>{feed.health_status}</span></td>
              <td className="error-msg">{feed.last_error || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 6: Create AnomalyFilter component**

`src/renderer-stats/src/components/AnomalyFilter.tsx`:
```tsx
import { useState } from 'react'
import { FeedHealth } from '../hooks/useStats'

interface Props {
  feeds: FeedHealth[]
}

export default function AnomalyFilter({ feeds }: Props) {
  const [filter, setFilter] = useState<'all' | 'failed' | 'inactive'>('all')

  const filtered = filter === 'all' ? feeds : feeds.filter(f => f.health_status === filter)

  return (
    <div className="anomaly-filter">
      <div className="filter-tabs">
        {(['all', 'failed', 'inactive'] as const).map(f => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'failed' ? 'Failed (>3x)' : 'Inactive (30d)'}
            {f !== 'all' && <span className="filter-count">{feeds.filter(x => x.health_status === f).length}</span>}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="filter-empty">No feeds match this filter</div>
      ) : (
        <ul className="filter-list">
          {filtered.map(f => (
            <li key={f.id} className={`filter-item status-${f.health_status}`}>
              <span className="filter-item-title">{f.title}</span>
              {f.last_error && <span className="filter-item-error">{f.last_error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Create Stats App**

`src/renderer-stats/src/App.tsx`:
```tsx
import { useStats } from './hooks/useStats'
import OverviewCards from './components/OverviewCards'
import MonthlyChart from './components/MonthlyChart'
import HealthTable from './components/HealthTable'
import AnomalyFilter from './components/AnomalyFilter'

export default function App() {
  const { monthly, health, overview } = useStats()

  return (
    <div className="stats-app">
      <h2>Subscription Statistics</h2>
      <OverviewCards overview={overview} />
      <MonthlyChart data={monthly} />
      <HealthTable feeds={health} />
      <AnomalyFilter feeds={health} />
    </div>
  )
}
```

- [ ] **Step 8: Create stats CSS**

`src/renderer-stats/src/styles/stats.css`:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; background: #f8f8f8; }

.stats-app { padding: 24px; max-width: 900px; margin: 0 auto; }
.stats-app h2 { margin-bottom: 20px; font-size: 18px; }

.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
.overview-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e0e0e0;
}
.overview-card-value { font-size: 28px; font-weight: 700; }
.overview-card-label { font-size: 12px; color: #666; margin-top: 4px; }

.monthly-chart {
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e0e0e0;
  margin-bottom: 24px;
}
.monthly-chart h3 { margin-bottom: 12px; font-size: 14px; }
.chart-bars { display: flex; align-items: flex-end; height: 120px; gap: 8px; }
.chart-bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
.chart-bar { width: 100%; max-width: 40px; background: #0060df; border-radius: 4px 4px 0 0; min-height: 2px; }
.chart-bar-label { font-size: 10px; color: #666; margin-top: 4px; }
.chart-bar-value { font-size: 10px; font-weight: 600; margin-top: 2px; }

.health-table {
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e0e0e0;
  margin-bottom: 24px;
  overflow-x: auto;
}
.health-table h3 { margin-bottom: 12px; font-size: 14px; }
.health-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
.health-table th { text-align: left; padding: 8px; border-bottom: 2px solid #e0e0e0; font-weight: 600; color: #666; }
.health-table td { padding: 8px; border-bottom: 1px solid #f0f0f0; }
.error-msg { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #999; }

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}
.badge-healthy { background: #e8f5e9; color: #2e7d32; }
.badge-failed { background: #fbe9e7; color: #c62828; }
.badge-inactive { background: #fff3e0; color: #e65100; }

.anomaly-filter {
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e0e0e0;
}
.anomaly-filter h3 { margin-bottom: 12px; font-size: 14px; }

.filter-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
.filter-tabs button {
  padding: 6px 12px;
  border: 1px solid #e0e0e0;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.filter-tabs button.active { background: #0060df; color: white; border-color: #0060df; }
.filter-count { margin-left: 4px; font-size: 11px; opacity: 0.7; }

.filter-empty { padding: 20px; text-align: center; color: #999; }
.filter-list { list-style: none; }
.filter-item { padding: 8px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; }
.filter-item-title { font-weight: 500; }
.filter-item-error { color: #c00; font-size: 12px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
```

- [ ] **Step 9: Update electron-vite config for stats renderer**

Add `renderer-stats` entry to `electron.vite.config.ts`:
```ts
// Add to the config object:
  'renderer-stats': {
    root: resolve('src/renderer-stats'),
    build: {
      outDir: 'out/renderer-stats',
      rollupOptions: {
        input: resolve('src/renderer-stats/index.html')
      }
    },
    plugins: [react()]
  }
```

- [ ] **Step 10: Wire stats window trigger from sidebar**

Update `src/main/windows/stats.ts` to load the stats renderer:
```ts
import { BrowserWindow } from 'electron'
import { join } from 'path'

let statsWindow: BrowserWindow | null = null

export function createStatsWindow(): void {
  if (statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.focus()
    return
  }

  statsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Subscription Statistics',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  statsWindow.loadFile(join(__dirname, '../renderer-stats/index.html'))
  statsWindow.on('closed', () => { statsWindow = null })
}
```

Add to sidebar toolbar in `src/renderer/src/components/Sidebar/Sidebar.tsx`:
```tsx
// Add a button to the sidebar toolbar:
<button onClick={() => window.api.settings.set('openStats', true)} title="Statistics">📊</button>
```

Add IPC handler in `src/main/ipc/settings.ts` to listen for stats trigger:
```ts
import { createStatsWindow } from '../windows/stats'
// Inside registerSettingsIpc:
  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
    if (key === 'openStats' && value === true) {
      createStatsWindow()
    }
  })
```

- [ ] **Step 11: Verify stats window opens**

Run: `pnpm dev`
Expected: Click stats button in sidebar → stats window opens with overview cards, chart, table, and filter

- [ ] **Step 12: Commit**

```bash
git add src/renderer-stats/ src/main/windows/stats.ts src/main/ipc/settings.ts src/renderer/src/components/Sidebar/ electron.vite.config.ts
git commit -m "feat: add stats window with overview, monthly chart, health table, and anomaly filter"
```

---

## Task 13: Application Menu and Polish

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/renderer/src/styles/global.css`

- [ ] **Step 1: Add full application menu to main entry**

Add to `src/main/index.ts` before `createMainWindow()` call:
```ts
import { Menu, ipcMain, shell } from 'electron'
// ... inside app.whenReady(), before createMainWindow():
function setupMenu(win: BrowserWindow) {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'RSS Reader',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'preferences', accelerator: 'CmdOrCtrl+,' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Feed', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('menu:addFeed') },
        { type: 'separator' },
        { label: 'Import OPML...', click: () => ipcMain.emit('opml:import') },
        { label: 'Export OPML...', click: () => ipcMain.emit('opml:export') },
        { type: 'separator' },
        { role: 'closeWindow' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Refresh Current', accelerator: 'CmdOrCtrl+R', click: () => win.webContents.send('menu:refreshCurrent') },
        { label: 'Refresh All', accelerator: 'CmdOrCtrl+Shift+R', click: () => win.webContents.send('menu:refreshAll') },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Statistics', click: () => createStatsWindow() },
        { role: 'minimize' },
        { role: 'zoom' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
```

- [ ] **Step 2: Handle menu events in renderer**

Add to `src/renderer/src/App.tsx`:
```tsx
import { useEffect } from 'react'
// ... inside App():
  useEffect(() => {
    const showAddFeed = () => setShowAddFeed(true)
    // Listen for menu events if needed
    return () => {}
  }, [])
```

- [ ] **Step 3: Final CSS polish for macOS native feel**

Update `src/renderer/src/styles/global.css` — add to the bottom:
```css
/* macOS traffic light spacing */
.app { padding-top: 28px; }

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #aaa; }

/* Selection */
::selection { background: #b3d4fc; }
```

- [ ] **Step 4: Verify full app works end-to-end**

Run: `pnpm dev`
Expected: Full three-pane layout, can add feeds, read articles, navigate with keyboard, open stats window

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add application menu, macOS polish, and menu event handling"
```

---

## Task 14: Build and Package

**Files:**
- Modify: `electron-builder.yml`

- [ ] **Step 1: Create electron-builder config**

`electron-builder.yml`:
```yaml
appId: com.rssreader.app
productName: RSS Reader
directories:
  buildResources: resources
  output: dist
mac:
  category: public.app-category.news
  target:
    - target: dmg
      arch:
        - universal
  icon: resources/icon.icns
  minimumSystemVersion: '11.0'
extraResources:
  - from: node_modules/better-sqlite3/prebuilds
    to: prebuilds
```

- [ ] **Step 2: Build the application**

Run: `pnpm package`
Expected: DMG generated in `dist/`

- [ ] **Step 3: Commit**

```bash
git add electron-builder.yml
git commit -m "feat: add electron-builder config for macOS DMG packaging"
```
