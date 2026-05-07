import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerStatsIpc(): void {
  ipcMain.handle('stats:getMonthly', (_event, feedId?: number, months?: number) => {
    const monthCount = months || 12
    const params: unknown[] = [`-${monthCount}`]

    const fetchQuery = `
      SELECT
        strftime('%Y-%m', fetched_at) as month,
        COUNT(*) as total_fetches,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        AVG(response_time) as avg_response_time
      FROM fetch_logs
      WHERE fetched_at >= datetime('now', ? || ' months')
      ${feedId ? ' AND feed_id = ?' : ''}
      GROUP BY strftime('%Y-%m', fetched_at)
    `
    if (feedId) params.push(feedId)

    const articleQuery = `
      SELECT
        strftime('%Y-%m', published_at) as month,
        COUNT(*) as articles_count
      FROM articles
      WHERE published_at IS NOT NULL
        AND published_at >= datetime('now', ? || ' months')
      ${feedId ? ' AND feed_id = ?' : ''}
      GROUP BY strftime('%Y-%m', published_at)
    `
    const articleParams: unknown[] = [`-${monthCount}`]
    if (feedId) articleParams.push(feedId)

    const fetchStats = getDb().prepare(fetchQuery).all(...params) as Record<string, unknown>[]
    const articleStats = getDb().prepare(articleQuery).all(...articleParams) as Record<string, unknown>[]

    const fetchMap = new Map(fetchStats.map(r => [r.month as string, r]))
    const articleMap = new Map(articleStats.map(r => [r.month as string, r.articles_count as number]))

    const allMonths: string[] = []
    const now = new Date()
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      allMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    return allMonths.map(month => {
      const fs = fetchMap.get(month)
      return {
        month,
        total_fetches: (fs?.total_fetches as number) || 0,
        success_count: (fs?.success_count as number) || 0,
        error_count: (fs?.error_count as number) || 0,
        articles_count: articleMap.get(month) || 0,
        avg_response_time: (fs?.avg_response_time as number) || 0,
      }
    })
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
          WHEN (SELECT COUNT(*) FROM fetch_logs WHERE feed_id = f.id AND status = 'success' ORDER BY fetched_at DESC LIMIT 3) = 0
            AND (SELECT COUNT(*) FROM fetch_logs WHERE feed_id = f.id ORDER BY fetched_at DESC LIMIT 3) >= 3
          THEN 'failed'
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
        (SELECT COUNT(*) FROM articles WHERE published_at IS NOT NULL AND strftime('%Y-%m', published_at) = strftime('%Y-%m', 'now')) as articles_this_month,
        (SELECT COUNT(DISTINCT feed_id) FROM articles WHERE published_at IS NOT NULL AND strftime('%Y-%m', published_at) = strftime('%Y-%m', 'now')) as active_feeds,
        (SELECT COUNT(*) FROM feeds WHERE
          (SELECT COUNT(*) FROM fetch_logs WHERE feed_id = feeds.id AND status = 'success' ORDER BY fetched_at DESC LIMIT 3) = 0
          AND (SELECT COUNT(*) FROM fetch_logs WHERE feed_id = feeds.id ORDER BY fetched_at DESC LIMIT 3) >= 3
        ) as failed_feeds
    `).get()

    return { feeds, overview }
  })
}
