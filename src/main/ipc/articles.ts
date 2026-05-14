import { ipcMain } from 'electron'
import { getDb } from '../db'
import { notifyArticleStateChanged, notifyAllRead } from './feeds'

export function registerArticleIpc(): void {
  ipcMain.handle('articles:list', (_event, feedId?: number, options?: { unreadOnly?: boolean; starredOnly?: boolean; folderId?: number; limit?: number; offset?: number }) => {
    const conditions: string[] = []
    const params: unknown[] = []

    if (feedId) {
      conditions.push('a.feed_id = ?')
      params.push(feedId)
    }
    if (options?.folderId) {
      conditions.push('f.folder_id = ?')
      params.push(options.folderId)
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
    const needsJoin = !!feedId || !!options?.folderId

    const articles = getDb().prepare(
      `SELECT a.*, f.title as feed_title, f.favicon_url, f.favicon_cached FROM articles a JOIN feeds f ON f.id = a.feed_id ${where} ORDER BY a.published_at DESC, a.fetched_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset)

    const countFrom = needsJoin ? 'articles a JOIN feeds f ON f.id = a.feed_id' : 'articles a'
    const countResult = getDb().prepare(
      `SELECT COUNT(*) as total FROM ${countFrom} ${where}`
    ).get(...params) as { total: number }

    return { articles, total: countResult.total }
  })

  ipcMain.handle('articles:markRead', (_event, id: number, read?: boolean) => {
    const newRead = read !== undefined ? (read ? 1 : 0) : 1
    const row = getDb().prepare('SELECT read, starred, feed_id FROM articles WHERE id = ?').get(id) as { read: number; starred: number; feed_id: number } | undefined
    const oldRead = row?.read ?? 0
    const feedId = row?.feed_id ?? 0
    const starred = (row?.starred ?? 0) === 1
    getDb().prepare('UPDATE articles SET read = ? WHERE id = ?').run(newRead, id)
    const readDelta = oldRead - newRead
    notifyArticleStateChanged({ id, feedId, read: newRead === 1, starred, readDelta })
  })

  ipcMain.handle('articles:markStarred', (_event, id: number, starred: boolean) => {
    const row = getDb().prepare('SELECT feed_id, read FROM articles WHERE id = ?').get(id) as { feed_id: number; read: number } | undefined
    const feedId = row?.feed_id ?? 0
    const read = (row?.read ?? 0) === 1
    getDb().prepare('UPDATE articles SET starred = ? WHERE id = ?').run(starred ? 1 : 0, id)
    notifyArticleStateChanged({ id, feedId, read, starred, readDelta: 0 })
  })

  ipcMain.handle('articles:markAllRead', (_event, feedId?: number, folderId?: number) => {
    if (feedId) {
      getDb().prepare('UPDATE articles SET read = 1 WHERE feed_id = ? AND read = 0').run(feedId)
    } else if (folderId) {
      getDb().prepare('UPDATE articles SET read = 1 WHERE feed_id IN (SELECT id FROM feeds WHERE folder_id = ?) AND read = 0').run(folderId)
    } else {
      getDb().prepare('UPDATE articles SET read = 1 WHERE read = 0').run()
    }
    notifyAllRead(feedId, folderId)
  })
}
