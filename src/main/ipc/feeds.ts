import { app, ipcMain, BrowserWindow } from 'electron'
import { getDb } from '../db'
import { fetchFeed, discoverFeed } from '../services/feed-fetcher'
import { enqueue } from '../services/refresh-queue'
import { deleteCachedIcon } from '../services/favicon'

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
      'INSERT INTO feeds (title, url, site_url, folder_id, open_in_browser) VALUES (?, ?, ?, ?, 1)'
    ).run(
      discoveredTitle || tempResult.feedTitle || feedUrl,
      feedUrl,
      tempResult.feedSiteUrl || null,
      folderId || null
    )

    await fetchFeed(info.lastInsertRowid as number, feedUrl)
    notifyFeedsUpdated()
    notifyArticlesUpdated()
    return { id: info.lastInsertRowid }
  })

  ipcMain.handle('feeds:remove', (_event, id: number) => {
    deleteCachedIcon(id)
    getDb().prepare('DELETE FROM articles WHERE feed_id = ?').run(id)
    getDb().prepare('DELETE FROM fetch_logs WHERE feed_id = ?').run(id)
    getDb().prepare('DELETE FROM feeds WHERE id = ?').run(id)
    notifyFeedsUpdated()
    notifyArticlesUpdated()
  })

  ipcMain.handle('feeds:update', (_event, id: number, changes: Record<string, unknown>) => {
    const allowed = ['title', 'url', 'folder_id', 'open_in_browser', 'refresh_interval', 'favicon_url', 'webview_max_width']
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
    const feeds = getDb().prepare('SELECT * FROM feeds').all() as any[]
    await enqueue(feeds)
  })

  ipcMain.handle('feeds:refreshStale', async (_event) => {
    const feeds = getDb().prepare(`
      SELECT * FROM feeds
      WHERE last_fetched_at IS NULL
         OR datetime(last_fetched_at, '+' || COALESCE(refresh_interval, 30) || ' minutes') <= datetime('now')
    `).all() as any[]
    if (feeds.length === 0) return
    await enqueue(feeds)
  })

  ipcMain.handle('feeds:clearFaviconCache', (_event, feedId: number) => {
    deleteCachedIcon(feedId)
    getDb().prepare('UPDATE feeds SET favicon_cached = NULL WHERE id = ?').run(feedId)
    notifyFeedsUpdated()
    notifyArticlesUpdated()
  })
}

export function broadcast(channel: string, data?: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, data)
  }
}

export function updateBadgeCount() {
  if (process.platform !== 'darwin') return
  const { count } = getDb().prepare('SELECT COUNT(*) as count FROM articles WHERE read = 0').get() as { count: number }
  app.dock.setBadge(count > 0 ? String(count) : '')
}

export function notifyFeedsUpdated() {
  broadcast('feeds:updated')
  updateBadgeCount()
}

export function notifyArticlesUpdated() {
  broadcast('articles:updated')
}

export function notifyArticleStateChanged(data: {
  id: number; feedId: number; read: boolean; starred: boolean; readDelta: number
}) {
  broadcast('articles:stateChanged', data)
  updateBadgeCount()
}

export function notifyAllRead(feedId?: number) {
  if (feedId) {
    broadcast('feeds:unreadReset', { feedId })
  } else {
    const feeds = getDb().prepare('SELECT id, (SELECT COUNT(*) FROM articles WHERE feed_id = feeds.id AND read = 0) as unread_count FROM feeds').all() as { id: number; unread_count: number }[]
    broadcast('feeds:unreadReset', { feeds })
  }
  updateBadgeCount()
}

export function notifyRefreshDone() {
  broadcast('feeds:refreshDone')
}
