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
    query += " GROUP BY strftime('%Y-%m', fetched_at) ORDER BY month"

    return getDb().prepare(query).all(...params)
  })

  ipcMain.handle('stats:getFeedHealth', () => {
    const feeds = getDb().prepare(`
      WITH article_counts AS (
        SELECT feed_id, COUNT(*) as cnt
        FROM articles
        WHERE published_at >= datetime('now', '-30 days')
        GROUP BY feed_id
      )
      SELECT
        f.id, f.title, f.url,
        COUNT(fl.id) as total_fetches,
        SUM(CASE WHEN fl.status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN fl.status = 'error' THEN 1 ELSE 0 END) as error_count,
        AVG(fl.response_time) as avg_response_time,
        (SELECT error_msg FROM fetch_logs WHERE feed_id = f.id AND status = 'error' ORDER BY fetched_at DESC LIMIT 1) as last_error,
        COALESCE(ac.cnt, 0) as articles_last_30_days,
        CASE
          WHEN (SELECT COUNT(*) FROM fetch_logs WHERE feed_id = f.id AND status = 'error' AND fetched_at >= datetime('now', '-7 days')) >= 3 THEN 'failed'
          WHEN COALESCE(ac.cnt, 0) = 0 THEN 'inactive'
          ELSE 'healthy'
        END as health_status
      FROM feeds f
      LEFT JOIN fetch_logs fl ON fl.feed_id = f.id
      LEFT JOIN article_counts ac ON ac.feed_id = f.id
      GROUP BY f.id
      ORDER BY f.title
    `).all()

    const overview = getDb().prepare(`
      SELECT
        (SELECT COUNT(*) FROM feeds) as total_feeds,
        (SELECT COUNT(*) FROM articles WHERE published_at >= datetime('now', '-30 days')) as articles_this_month,
        (SELECT COUNT(DISTINCT feed_id) FROM articles WHERE published_at >= datetime('now', '-30 days')) as active_feeds,
        (SELECT COUNT(*) FROM feeds WHERE id IN (
          SELECT feed_id FROM fetch_logs WHERE status = 'error' AND fetched_at >= datetime('now', '-7 days')
          GROUP BY feed_id HAVING COUNT(*) >= 3
        )) as failed_feeds
    `).get()

    return { feeds, overview }
  })
}
