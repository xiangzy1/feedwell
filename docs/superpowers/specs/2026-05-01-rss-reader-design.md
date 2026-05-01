# RSS Reader for macOS — Design Spec

Date: 2026-05-01

## Overview

A native-feeling macOS RSS reader built with Electron + React + TypeScript. NetNewsWire-inspired three-pane layout with subscription statistics and per-feed configuration.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Electron + electron-vite |
| Frontend | React + TypeScript |
| Database | SQLite via better-sqlite3 |
| RSS Parsing | feedparser |
| Build/Package | electron-vite + electron-builder (DMG) |
| Package Manager | pnpm |

## Project Structure

```
rss-reader/
├── electron.vite.config.ts
├── package.json
├── src/
│   ├── main/                    # Main process
│   │   ├── index.ts             # Entry, window creation
│   │   ├── ipc/                 # IPC handlers
│   │   ├── db/                  # SQLite init + migrations
│   │   ├── services/
│   │   │   ├── feed-fetcher.ts  # RSS fetch + parse
│   │   │   ├── scheduler.ts     # Periodic refresh scheduler
│   │   │   └── opml.ts          # OPML import/export
│   │   └── windows/
│   │       ├── main.ts          # Main window management
│   │       └── stats.ts         # Stats window management
│   ├── preload/
│   │   └── index.ts             # contextBridge API
│   └── renderer/
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── Sidebar/     # Feed list
│       │   │   ├── ArticleList/ # Article list
│       │   │   ├── ArticleView/ # Article content
│       │   │   └── Stats/       # Stats panel components
│       │   ├── hooks/           # React hooks
│       │   └── styles/          # CSS
│       └── index.html
├── resources/                   # Icons and assets
└── scripts/                     # Build/package scripts
```

## Database Schema

```sql
CREATE TABLE folders (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE feeds (
  id               INTEGER PRIMARY KEY,
  title            TEXT NOT NULL,
  url              TEXT NOT NULL UNIQUE,
  site_url         TEXT,
  folder_id        INTEGER REFERENCES folders(id),
  favicon_url      TEXT,
  open_in_browser  BOOLEAN DEFAULT 0,
  refresh_interval INTEGER DEFAULT 30,
  last_fetched_at  TEXT,
  created_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE articles (
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
  fetched_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(feed_id, guid)
);

CREATE TABLE fetch_logs (
  id            INTEGER PRIMARY KEY,
  feed_id       INTEGER NOT NULL REFERENCES feeds(id),
  status        TEXT NOT NULL,          -- 'success' | 'error'
  error_msg     TEXT,
  articles_count INTEGER DEFAULT 0,
  response_time INTEGER,               -- ms
  fetched_at    TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Data Flow

```
Main Process                          Renderer (React)
─────────────                         ─────────────────
Scheduler ──→ FeedFetcher ──→ SQLite
     ↑              ↑              ↑   │
     └────── IPC Handlers ──────────┘  │
            (contextBridge)             │
                                        │
                                   ┌────┴─────────┐
                                   │  Three-Pane   │
                                   │  Layout       │
                                   └──────────────┘
```

### IPC API (exposed via preload)

**Feeds:**
- `api.feeds.add(url, folderId?)` — add subscription
- `api.feeds.remove(id)` — remove subscription
- `api.feeds.update(id, changes)` — update feed config
- `api.feeds.list()` — list all feeds
- `api.feeds.refresh(id?)` — refresh single feed (with id) or all feeds (no args)

**Articles:**
- `api.articles.list(feedId?, options?)` — query with `{ unreadOnly, starredOnly, limit, offset }`
- `api.articles.markRead(id)` — mark article as read
- `api.articles.markStarred(id, starred)` — toggle star

**Folders:**
- `api.folders.create(name)` — create folder
- `api.folders.reorder(orderedIds)` — reorder folders

**OPML:**
- `api.opml.import(filePath?)` — import subscriptions
- `api.opml.export()` — export subscriptions

**Stats:**
- `api.stats.getMonthly(feedId?, months?)` — monthly article counts and fetch success/fail rates
- `api.stats.getFeedHealth()` — list of failed/inactive feeds

**Settings:**
- `api.settings.get(key)` / `api.settings.set(key, value)`

### Refresh Scheduler

1. On app start, `Scheduler` reads all feeds and their `refresh_interval` values
2. Each feed is independently scheduled via `setTimeout` (re-scheduled after each fetch)
3. `FeedFetcher` makes HTTP request, parses with `feedparser`, writes to `articles` (dedup by `guid`), logs to `fetch_logs`
4. IPC notification to Renderer to update UI

## UI Design

### Main Window — Three-Pane Layout

| Pane | Content | Interaction |
|------|---------|-------------|
| Sidebar | Smart folders (All Unread / Today / Starred) + custom folders + feeds | Click to select, drag to reorder/move, right-click menu (edit/delete/refresh/stats), bottom toolbar (add feed, OPML import/export, open stats window) |
| ArticleList | Articles for selected feed | Title + time + unread indicator, click to select, arrow keys to navigate, `j`/`k` shortcuts |
| ArticleView | Full article HTML rendering | Title/source/time/star/open link buttons. If `open_in_browser` is set for the feed, clicking an article opens `shell.openExternal(url)` |

### Stats Window (separate BrowserWindow)

| Section | Content |
|---------|---------|
| Overview cards | Total feeds, articles this month, active feeds, failed feeds |
| Monthly trend chart | Line chart of article counts over last 6-12 months |
| Request health table | Per-feed success rate, avg response time, last error |
| Anomaly filter | Filter: All / Failed (>3 consecutive failures) / Inactive (0 articles in 30 days) |

### Add Feed Dialog

Triggered by menu or `Cmd+N`. Small modal: enter URL → auto-detect feed via `<link rel="alternate">` → preview title → confirm to add.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `k` | Next/previous article |
| `r` | Mark as read |
| `s` | Toggle star |
| `u` | Toggle unread |
| `Cmd+R` | Refresh current feed |
| `Cmd+Shift+R` | Refresh all feeds |
| `Cmd+N` | Add subscription |

## Edge Cases and Error Handling

### RSS Parsing
- `feedparser` handles RSS 2.0/1.0/Atom/RDF with automatic format detection
- Non-feed URLs: attempt auto-discovery via `<link rel="alternate">` in HTML
- Failed feeds logged to `fetch_logs` with `status: 'error'`, no blocking of other feeds
- Request timeout: 15 seconds per feed

### Network and Offline
- Pause scheduler on network failure (detected via failed requests)
- Auto-resume when network recovers
- Cached articles remain readable offline

### Data Safety
- SQLite WAL mode for concurrent read/write
- `PRAGMA integrity_check` on startup; prompt user if corrupted
- Auto-backup: weekly `feeds.db.bak` in same directory

### Performance
- Large article content loaded on demand (paginate queries)
- `fetch_logs` retention: 90 days, cleaned on startup
- Virtual list for article rendering (`react-virtuoso`)

### Packaging
- DMG for macOS via `electron-builder`
- App signing and auto-update deferred to future iteration
