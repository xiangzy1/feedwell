import { ipcMain } from 'electron'
import { getDb } from '../db'
import { notifyFeedsUpdated } from './feeds'

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
      `SELECT a.*, f.title as feed_title, f.favicon_url, f.favicon_cached FROM articles a JOIN feeds f ON f.id = a.feed_id ${where} ORDER BY a.published_at DESC, a.fetched_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset)

    const countResult = getDb().prepare(
      `SELECT COUNT(*) as total FROM articles a ${where}`
    ).get(...params) as { total: number }

    return { articles, total: countResult.total }
  })

  ipcMain.handle('articles:markRead', (_event, id: number, read?: boolean) => {
    getDb().prepare('UPDATE articles SET read = ? WHERE id = ?').run(read !== undefined ? (read ? 1 : 0) : 1, id)
    notifyFeedsUpdated()
  })

  ipcMain.handle('articles:markStarred', (_event, id: number, starred: boolean) => {
    getDb().prepare('UPDATE articles SET starred = ? WHERE id = ?').run(starred ? 1 : 0, id)
  })

  ipcMain.handle('articles:markAllRead', (_event, feedId?: number) => {
    if (feedId) {
      getDb().prepare('UPDATE articles SET read = 1 WHERE feed_id = ? AND read = 0').run(feedId)
    } else {
      getDb().prepare('UPDATE articles SET read = 1 WHERE read = 0').run()
    }
    notifyFeedsUpdated()
  })
}
