import { ipcMain, BrowserWindow } from 'electron'
import { getDb } from '../db'
import { fetchFeed, discoverFeed } from '../services/feed-fetcher'

let _bulkRefreshing = false

function safeSend(sender: BrowserWindow | null, channel: string, data?: any) {
  if (sender && !sender.isDestroyed()) sender.webContents.send(channel, data)
}

async function bulkRefresh(feeds: any[], sender: BrowserWindow | null) {
  for (let i = 0; i < feeds.length; i++) {
    await fetchFeed(feeds[i].id, feeds[i].url)
    safeSend(sender, 'feeds:refreshProgress', { current: i + 1, total: feeds.length })
  }
  safeSend(sender, 'feeds:refreshDone')
  notifyFeedsUpdated()
  notifyArticlesUpdated()
}

export function registerFeedIpc(): void {
  ipcMain.handle('feeds:add', async (_event, url: string, folderId?: number) => {
    let feedUrl = url
    let discoveredTitle: string | undefined

    if (!url.match(/\.(xml|rss|atom)(\?|$)/i) && !url.includes('/feed') && !url.includes('/rss')) {
      const discovered = await discoverFeed(url)
      if (discovered) {
        feedUrl = discovered.feedUrl
        discoveredTitle = discovered.title
      }
    }

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
      SELECT f.*, fo.name as folder_name, COUNT(CASE WHEN a.read = 0 THEN 1 END) as unread_count
      FROM feeds f
      LEFT JOIN articles a ON a.feed_id = f.id
      LEFT JOIN folders fo ON fo.id = f.folder_id
      GROUP BY f.id
      ORDER BY fo.name, f.title
    `).all()
  })

  ipcMain.handle('feeds:refresh', async (_event, id?: number) => {
    if (id) {
      const feed = getDb().prepare('SELECT * FROM feeds WHERE id = ?').get(id) as any
      if (feed) await fetchFeed(feed.id, feed.url)
      notifyFeedsUpdated()
      notifyArticlesUpdated()
      return
    }
    if (_bulkRefreshing) return
    _bulkRefreshing = true
    try {
      const feeds = getDb().prepare('SELECT * FROM feeds').all() as any[]
      const sender = BrowserWindow.fromWebContents(_event.sender)
      await bulkRefresh(feeds, sender)
    } finally {
      _bulkRefreshing = false
    }
  })

  ipcMain.handle('feeds:refreshStale', async (_event) => {
    if (_bulkRefreshing) return
    _bulkRefreshing = true
    try {
      const feeds = getDb().prepare(`
        SELECT * FROM feeds
        WHERE last_fetched_at IS NULL
           OR datetime(last_fetched_at, '+' || COALESCE(refresh_interval, 30) || ' minutes') <= datetime('now')
      `).all() as any[]
      if (feeds.length === 0) return
      const sender = BrowserWindow.fromWebContents(_event.sender)
      await bulkRefresh(feeds, sender)
    } finally {
      _bulkRefreshing = false
    }
  })
}

export function notifyFeedsUpdated() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('feeds:updated')
  }
}

export function notifyArticlesUpdated() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('articles:updated')
  }
}
