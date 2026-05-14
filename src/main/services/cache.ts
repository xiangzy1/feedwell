import { app, type Session } from 'electron'
import { join } from 'path'
import { readdir, stat } from 'fs/promises'
import { getDb } from '../db'

export const MB = 1024 * 1024

export interface CacheSizes {
  webviewCache: number
  databaseSize: number
  faviconSize: number
  total: number
}

export async function getCacheSizes(sessions: Set<Session>): Promise<CacheSizes> {
  const cachePromises = [...sessions].map(ses => ses.getCacheSize().catch(() => 0))
  const cacheSizes = await Promise.all(cachePromises)
  const webviewCache = cacheSizes.reduce((sum, n) => sum + n, 0)

  const userData = app.getPath('userData')
  const dbFiles = ['feeds.db', 'feeds.db-wal', 'feeds.db-shm']
  const dbStats = await Promise.all(dbFiles.map(f => stat(join(userData, f)).then(s => s.size, () => 0)))
  const databaseSize = dbStats.reduce((sum, n) => sum + n, 0)

  let faviconSize = 0
  const iconsDir = join(userData, 'icons')
  try {
    const files = await readdir(iconsDir)
    const stats = await Promise.all(files.map(f => stat(join(iconsDir, f)).then(s => s.size, () => 0)))
    faviconSize = stats.reduce((sum, n) => sum + n, 0)
  } catch { /* ignore */ }

  return { webviewCache, databaseSize, faviconSize, total: webviewCache + databaseSize + faviconSize }
}

export function cleanOldestArticles(targetBytes: number): number {
  if (targetBytes <= 0) return 0
  const db = getDb()
  let freedBytes = 0
  const batchSize = 200
  const maxBatches = 500

  const deleteStmts = {
    translations: db.prepare(`DELETE FROM translations WHERE article_id IN (SELECT id FROM _batch)`),
    summaries: db.prepare(`DELETE FROM summaries WHERE article_id IN (SELECT id FROM _batch)`),
    articles: db.prepare(`DELETE FROM articles WHERE id IN (SELECT id FROM _batch)`),
  }

  const cleanup = db.transaction(() => {
    const articles = db.prepare(
      `SELECT id, COALESCE(LENGTH(content), 0) + COALESCE(LENGTH(summary), 0) AS size_estimate
       FROM articles
       WHERE starred = 0
       ORDER BY fetched_at ASC
       LIMIT ?`
    ).all(batchSize) as { id: number; size_estimate: number }[]

    if (articles.length === 0) return 0

    const batchBytes = articles.reduce((sum, a) => sum + a.size_estimate, 0)
    if (batchBytes === 0) return 0

    const ids = articles.map(a => a.id)
    const placeholders = ids.map(() => '?').join(',')
    db.prepare(`CREATE TEMP TABLE _batch (id INTEGER PRIMARY KEY)`).run()
    db.prepare(`INSERT INTO _batch VALUES ${ids.map(() => '(?)').join(',')}`).run(...ids)

    deleteStmts.translations.run()
    deleteStmts.summaries.run()
    deleteStmts.articles.run()
    db.prepare(`DROP TABLE _batch`).run()

    return batchBytes
  })

  for (let i = 0; i < maxBatches && freedBytes < targetBytes; i++) {
    const batchBytes = cleanup() as number
    if (batchBytes === 0) break
    freedBytes += batchBytes
  }

  return freedBytes
}

export function clearDerivedCache(): void {
  const db = getDb()
  db.prepare('DELETE FROM translations').run()
  db.prepare('DELETE FROM summaries').run()
  db.prepare("DELETE FROM fetch_logs WHERE fetched_at < datetime('now', '-7 days')").run()
}

export async function clearAllWebviewCache(sessions: Set<Session>): Promise<void> {
  await Promise.all([...sessions].map(ses => ses.clearCache()))
}

export async function clearCaches(sessions: Set<Session>): Promise<void> {
  clearDerivedCache()
  await clearAllWebviewCache(sessions)
  try {
    getDb().pragma('wal_checkpoint(TRUNCATE)')
  } catch { /* ignore */ }
}

export async function performAutoCleanup(sessions: Set<Session>, maxBytes: number): Promise<void> {
  if (maxBytes <= 0) return
  const sizes = await getCacheSizes(sessions)
  if (sizes.total <= maxBytes) return

  await clearCaches(sessions)

  const remaining = await getCacheSizes(sessions)
  if (remaining.total > maxBytes) {
    cleanOldestArticles(remaining.total - maxBytes)
    try {
      getDb().pragma('wal_checkpoint(TRUNCATE)')
    } catch { /* ignore */ }
  }
}
